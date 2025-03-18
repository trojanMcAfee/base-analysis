#!/usr/bin/env python3

import os
import time
import argparse
import pickle
from datetime import datetime, timedelta
from web3 import Web3
from dotenv import load_dotenv
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
import seaborn as sns
from scipy import stats

# Load environment variables from .env file
load_dotenv()

# Get the RPC URL from environment variables
BASE_RPC_URL = os.getenv("BASE_RPC_URL")

# Define contract details
MORPHO_ADDRESS = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb"
MARKET_ID = "0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836"

# Block range
START_BLOCK = 19326981  # Market creation block
END_BLOCK = 27750945    # Specified end block

# Cache file path
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cache")
CACHE_FILE = os.path.join(CACHE_DIR, "morpho_market_data.pickle")

# Output paths
PLOTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "plots")
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "raw-data")

# ABI for just the market function we need
ABI = [
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "id",
                "type": "bytes32"
            }
        ],
        "name": "market",
        "outputs": [
            {
                "internalType": "uint128",
                "name": "totalSupplyAssets",
                "type": "uint128"
            },
            {
                "internalType": "uint128",
                "name": "totalSupplyShares",
                "type": "uint128"
            },
            {
                "internalType": "uint128",
                "name": "totalBorrowAssets",
                "type": "uint128"
            },
            {
                "internalType": "uint128",
                "name": "totalBorrowShares",
                "type": "uint128"
            },
            {
                "internalType": "uint128",
                "name": "lastUpdate",
                "type": "uint128"
            },
            {
                "internalType": "uint128",
                "name": "fee",
                "type": "uint128"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

def get_block_timestamp(w3, block_number):
    """Get the timestamp for a block number"""
    block = w3.eth.get_block(block_number)
    return block.timestamp

def generate_block_numbers(w3, start_block, end_block):
    """
    Generate block numbers at approximately 2-week intervals
    Base chain block time is ~2 seconds, so 2 weeks is roughly 604800 seconds or ~302400 blocks
    """
    # Approximate number of blocks in 2 weeks (14 days)
    blocks_in_two_weeks = 302400
    
    # Generate the list of blocks
    blocks = []
    current_block = start_block
    
    print("Generating block numbers at approximately 2-week intervals...")
    
    while current_block <= end_block:
        blocks.append(current_block)
        current_block += blocks_in_two_weeks
    
    # Make sure the end block is included
    if blocks[-1] != end_block and current_block > end_block:
        blocks.append(end_block)
    
    print(f"Generated {len(blocks)} block numbers to query")
    return blocks

def load_cached_data():
    """Load data from cache if available"""
    if os.path.exists(CACHE_FILE):
        print(f"Loading cached data from {CACHE_FILE}...")
        try:
            with open(CACHE_FILE, 'rb') as f:
                cached_data = pickle.load(f)
                
            # Verify the cache contains the expected structure
            if (isinstance(cached_data, dict) and 
                'start_block' in cached_data and 
                'end_block' in cached_data and 
                'market_data' in cached_data and 
                cached_data['start_block'] == START_BLOCK and 
                cached_data['end_block'] == END_BLOCK):
                
                print(f"Cache hit! Using data for blocks {START_BLOCK} to {END_BLOCK}")
                return cached_data['market_data']
            else:
                print("Cache exists but doesn't match the current block range. Will query fresh data.")
                return None
        except Exception as e:
            print(f"Error loading cache: {e}")
            return None
    else:
        print("No cache file found.")
        return None

def save_to_cache(market_data):
    """Save data to cache file"""
    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR)
        
    cache_data = {
        'start_block': START_BLOCK,
        'end_block': END_BLOCK,
        'market_data': market_data,
        'timestamp': datetime.now().isoformat()
    }
    
    try:
        with open(CACHE_FILE, 'wb') as f:
            pickle.dump(cache_data, f)
        print(f"Data saved to cache: {CACHE_FILE}")
    except Exception as e:
        print(f"Error saving to cache: {e}")

def query_market_data(w3, morpho_contract, block_number):
    """Query market data at a specific block number"""
    try:
        # Query market data
        market_data = morpho_contract.functions.market(MARKET_ID).call(block_identifier=block_number)
        
        # Get block timestamp
        timestamp = get_block_timestamp(w3, block_number)
        date = datetime.fromtimestamp(timestamp)
        
        # Unpack the returned data
        (
            totalSupplyAssets, 
            totalSupplyShares, 
            totalBorrowAssets, 
            totalBorrowShares,
            lastUpdate,
            fee
        ) = market_data
        
        # Calculate utilization rate (if supply is zero, utilization is zero)
        utilization_rate = 0
        if totalSupplyAssets > 0:
            utilization_rate = (totalBorrowAssets / totalSupplyAssets) * 100
        
        return {
            'block_number': block_number,
            'timestamp': timestamp,
            'date': date,
            'totalSupplyAssets': totalSupplyAssets,
            'totalSupplyShares': totalSupplyShares,
            'totalBorrowAssets': totalBorrowAssets,
            'totalBorrowShares': totalBorrowShares,
            'utilization_rate': utilization_rate,
            'fee': fee
        }
        
    except Exception as e:
        print(f"Error querying block {block_number}: {e}")
        return None

def fetch_market_data(w3, morpho_contract, use_cache=True, force_refresh=False):
    """Fetch market data, using cache if available"""
    # Try to load from cache first
    market_data = None
    if use_cache and not force_refresh:
        market_data = load_cached_data()
    
    # If cache miss or forced refresh, query the blockchain
    if market_data is None:
        # Generate block numbers to query
        block_numbers = generate_block_numbers(w3, START_BLOCK, END_BLOCK)
        
        # Query market data for each block
        market_data = []
        
        print("\nQuerying market data at each block...")
        for i, block in enumerate(block_numbers):
            print(f"Querying block {block} ({i+1}/{len(block_numbers)})...")
            data = query_market_data(w3, morpho_contract, block)
            if data:
                market_data.append(data)
            # Small delay to avoid rate limiting
            time.sleep(0.5)
        
        # Save to cache for future use
        if market_data:
            save_to_cache(market_data)
    
    return market_data

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Track Morpho market data over time with projections')
    parser.add_argument('--force-refresh', action='store_true', 
                      help='Force refresh data from the blockchain instead of using cache')
    parser.add_argument('--no-cache', action='store_true',
                      help='Disable caching (will not read or write cache)')
    parser.add_argument('--show-plot', action='store_true',
                      help='Display the plot window (default: only save to file)')
    return parser.parse_args()

def main():
    # Parse command line arguments
    args = parse_args()
    
    # Create output directories if they don't exist
    if not os.path.exists(PLOTS_DIR):
        os.makedirs(PLOTS_DIR)
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    
    # Create subdirectories for PNG and SVG files
    png_dir = os.path.join(PLOTS_DIR, "png")
    svg_dir = os.path.join(PLOTS_DIR, "svg")
    if not os.path.exists(png_dir):
        os.makedirs(png_dir)
    if not os.path.exists(svg_dir):
        os.makedirs(svg_dir)
    
    # Set the style for plots
    sns.set_style("whitegrid")
    plt.rcParams.update({'font.size': 12})
    
    # Suppress matplotlib warnings and text input context errors
    import warnings
    warnings.filterwarnings("ignore", ".*imkxpc_getApplicationProperty.*")
    warnings.filterwarnings("ignore", ".*_TIPropertyValueIsValid.*")
    
    # Connect to Base network
    w3 = Web3(Web3.HTTPProvider(BASE_RPC_URL))
    
    # Check connection
    if not w3.is_connected():
        print("Failed to connect to Base network")
        return
    
    print(f"Connected to Base network. Current block: {w3.eth.block_number}")
    
    # Create contract instance
    morpho_contract = w3.eth.contract(address=MORPHO_ADDRESS, abi=ABI)
    
    # Fetch data (from cache if available)
    market_data = fetch_market_data(
        w3, 
        morpho_contract, 
        use_cache=not args.no_cache, 
        force_refresh=args.force_refresh
    )
    
    if not market_data:
        print("No data was collected. Exiting.")
        return
    
    # Convert to DataFrame for easier manipulation
    df = pd.DataFrame(market_data)
    
    # Format supply and borrow assets to be more readable (assuming 6 decimals for USDC)
    df['totalSupplyAssets_formatted'] = df['totalSupplyAssets'] / 1e6
    df['totalBorrowAssets_formatted'] = df['totalBorrowAssets'] / 1e6
    
    # Add a column for available liquidity
    df['availableLiquidity_formatted'] = df['totalSupplyAssets_formatted'] - df['totalBorrowAssets_formatted']
    
    # Calculate growth ratios and projections
    # Filter out rows with zero values to avoid division by zero
    df_nonzero = df[df['totalSupplyAssets_formatted'] > 0].copy()
    
    if len(df_nonzero) >= 10:  # Need a reasonable number of data points
        print("\n=== Calculating Growth and Linear Projections ===")
        
        # Use only the most recent 3 months of data to calculate growth rate
        # This gives a more realistic projection than using the entire history
        # (because early growth rates in DeFi are typically not sustainable)
        latest_date = df_nonzero['date'].max()
        three_months_ago = latest_date - timedelta(days=90)
        recent_df = df_nonzero[df_nonzero['date'] >= three_months_ago].copy()
        
        if len(recent_df) >= 5:  # Need at least a few points in the recent period
            # Calculate total growth over the measurement period
            first_supply = recent_df.iloc[0]['totalSupplyAssets_formatted']
            last_supply = recent_df.iloc[-1]['totalSupplyAssets_formatted']
            first_borrow = recent_df.iloc[0]['totalBorrowAssets_formatted']
            last_borrow = recent_df.iloc[-1]['totalBorrowAssets_formatted']
            
            # Calculate time difference in days
            time_diff_days = (recent_df.iloc[-1]['date'] - recent_df.iloc[0]['date']).days
            
            if time_diff_days > 0:
                # Calculate daily absolute growth (not percentage)
                supply_daily_growth = (last_supply - first_supply) / time_diff_days
                borrow_daily_growth = (last_borrow - first_borrow) / time_diff_days
                
                # Cap the daily growth to prevent extremely aggressive projections
                # This is equivalent to approximately the same cap as before but expressed as daily growth
                max_daily_growth_supply = first_supply * 0.008  # ~30% monthly when expressed as daily
                max_daily_growth_borrow = first_borrow * 0.008
                
                supply_daily_growth = min(supply_daily_growth, max_daily_growth_supply)
                borrow_daily_growth = min(borrow_daily_growth, max_daily_growth_borrow)
                
                # Convert to annual rates for display
                supply_annual_growth = (supply_daily_growth * 365 / first_supply) * 100
                borrow_annual_growth = (borrow_daily_growth * 365 / first_borrow) * 100
                
                print(f"Daily Supply Growth Amount: {supply_daily_growth:,.2f} USDC")
                print(f"Daily Borrow Growth Amount: {borrow_daily_growth:,.2f} USDC")
                print(f"Projected Annual Supply Growth Rate: {supply_annual_growth:.2f}%")
                print(f"Projected Annual Borrow Growth Rate: {borrow_annual_growth:.2f}%")
                
                # Generate future dates for projections (every 2 weeks for 1 year)
                last_date = df['date'].max()
                future_dates = []
                for i in range(1, 27):  # 26 two-week periods in a year
                    future_dates.append(last_date + timedelta(days=14*i))
                
                # Create projections dataframe
                proj_df = pd.DataFrame()
                proj_df['date'] = future_dates
                
                # Start with initial values
                initial_supply = df.iloc[-1]['totalSupplyAssets_formatted']
                initial_borrow = df.iloc[-1]['totalBorrowAssets_formatted']
                
                # Project values using linear growth
                proj_df['totalSupplyAssets_formatted'] = [
                    initial_supply + (supply_daily_growth * 14 * (i+1))  # Add fixed amount for each period
                    for i in range(len(future_dates))
                ]
                
                proj_df['totalBorrowAssets_formatted'] = [
                    initial_borrow + (borrow_daily_growth * 14 * (i+1))
                    for i in range(len(future_dates))
                ]
                
                # Calculate derived metrics
                proj_df['availableLiquidity_formatted'] = proj_df['totalSupplyAssets_formatted'] - proj_df['totalBorrowAssets_formatted']
                proj_df['utilization_rate'] = (proj_df['totalBorrowAssets_formatted'] / proj_df['totalSupplyAssets_formatted']) * 100
                
                # Display projected values at quarterly intervals
                proj_display = proj_df.iloc[[5, 12, 18, 25]].copy()  # Approximately 3, 6, 9, and 12 months
                proj_display['Date'] = proj_display['date'].dt.strftime('%Y-%m-%d')
                proj_display['Total Supply (USDC)'] = proj_display['totalSupplyAssets_formatted'].map(lambda x: f"{x:,.2f}")
                proj_display['Total Borrow (USDC)'] = proj_display['totalBorrowAssets_formatted'].map(lambda x: f"{x:,.2f}")
                proj_display['Available Liquidity (USDC)'] = proj_display['availableLiquidity_formatted'].map(lambda x: f"{x:,.2f}")
                proj_display['Utilization Rate (%)'] = proj_display['utilization_rate'].map(lambda x: f"{x:.2f}%")
                
                print("\n=== Projected cbBTC/USDC Market Data (Next Year) - Linear Model ===")
                print(proj_display[['Date', 'Total Supply (USDC)', 'Total Borrow (USDC)', 'Available Liquidity (USDC)', 'Utilization Rate (%)']].to_string(index=False))
            else:
                print("Time difference too small for meaningful rate calculation.")
                proj_df = None
        else:
            print("Not enough recent data points to calculate growth rates.")
            proj_df = None
    else:
        print("Not enough data points to calculate growth ratios and projections.")
        proj_df = None
    
    # Display the historical data table
    print("\n=== cbBTC/USDC Market Data at 2-Week Intervals ===")
    display_df = df[['block_number', 'date', 'totalSupplyAssets_formatted', 'totalBorrowAssets_formatted', 'availableLiquidity_formatted', 'utilization_rate']].copy()
    display_df.columns = ['Block', 'Date', 'Total Supply (USDC)', 'Total Borrow (USDC)', 'Available Liquidity (USDC)', 'Utilization Rate (%)']
    
    # Convert to string for better display
    display_df['Date'] = display_df['Date'].dt.strftime('%Y-%m-%d')
    display_df['Total Supply (USDC)'] = display_df['Total Supply (USDC)'].map(lambda x: f"{x:,.2f}")
    display_df['Total Borrow (USDC)'] = display_df['Total Borrow (USDC)'].map(lambda x: f"{x:,.2f}")
    display_df['Available Liquidity (USDC)'] = display_df['Available Liquidity (USDC)'].map(lambda x: f"{x:,.2f}")
    display_df['Utilization Rate (%)'] = display_df['Utilization Rate (%)'].map(lambda x: f"{x:.2f}%")
    
    print(display_df.to_string(index=False))
    
    # Save to CSV (including projections if available)
    csv_filename = os.path.join(DATA_DIR, "morpho_market_history.csv")
    if proj_df is not None:
        # Mark projected data
        df['is_projection'] = False
        proj_df['is_projection'] = True
        proj_df['block_number'] = None
        
        # Combine historical and projected data
        combined_df = pd.concat([df, proj_df], ignore_index=True)
        combined_df.to_csv(csv_filename, index=False)
    else:
        df.to_csv(csv_filename, index=False)
    
    print(f"\nData saved to {csv_filename}")
    
    # Create a figure for plotting
    fig, ax = plt.figure(figsize=(18, 10)), plt.gca()
    
    # Plot historical data
    ax.plot(df['date'], df['totalSupplyAssets_formatted'], 'b-', linewidth=3, label='_nolegend_')
    ax.plot(df['date'], df['totalBorrowAssets_formatted'], 'r-', linewidth=3, label='_nolegend_')
    ax.plot(df['date'], df['availableLiquidity_formatted'], 'g-', linewidth=2.5, alpha=0.7, label='_nolegend_')
    
    # Add projections if available
    if proj_df is not None:
        # Draw a vertical line separating actual and projected data
        last_date = df['date'].max()
        ymin, ymax = ax.get_ylim()
        ax.axvline(x=last_date, color='gray', linestyle='--', alpha=0.7)
        
        # ---- Bullish Projection (Green) ----
        # Plot projected data with different line styles - green for bullish projection
        ax.plot(proj_df['date'], proj_df['totalSupplyAssets_formatted'], 'g--', linewidth=2.5, marker='o', markersize=4, markevery=3, label='Bullish')
        ax.plot(proj_df['date'], proj_df['totalBorrowAssets_formatted'], color='g', linewidth=3.0, marker='o', markersize=5, markevery=3, 
                dashes=[5, 2, 1, 2], label='_nolegend_')  # Very distinctive pattern
        ax.plot(proj_df['date'], proj_df['availableLiquidity_formatted'], 'g:', linewidth=2, marker='o', markersize=4, markevery=3, alpha=0.7, label='_nolegend_')
        
        # Add annotation for bullish projected end values
        proj_end = proj_df.iloc[-1]
        ax.annotate(f"Bullish Supply: {proj_end['totalSupplyAssets_formatted']:,.2f}",
                    xy=(proj_end['date'], proj_end['totalSupplyAssets_formatted']),
                    xytext=(15, 15), textcoords='offset points', fontsize=11,
                    bbox=dict(boxstyle="round,pad=0.4", fc="white", ec="green", alpha=0.9))
        
        ax.annotate(f"Bullish Borrow: {proj_end['totalBorrowAssets_formatted']:,.2f}",
                    xy=(proj_end['date'], proj_end['totalBorrowAssets_formatted']),
                    xytext=(15, -25), textcoords='offset points', fontsize=11,
                    bbox=dict(boxstyle="round,pad=0.4", fc="white", ec="green", alpha=0.9))
        
        ax.annotate(f"Bullish Liquidity: {proj_end['availableLiquidity_formatted']:,.2f}",
                    xy=(proj_end['date'], proj_end['availableLiquidity_formatted']),
                    xytext=(15, 15), textcoords='offset points', fontsize=11,
                    bbox=dict(boxstyle="round,pad=0.4", fc="white", ec="green", alpha=0.9))
        
        # ---- Neutral Projection (Yellow) ----
        # Create neutral projections dataframe (50% of the growth rate)
        half_rate_df = pd.DataFrame()
        half_rate_df['date'] = future_dates
        
        # Calculate neutral growth
        supply_daily_growth_half = supply_daily_growth * 0.5
        borrow_daily_growth_half = borrow_daily_growth * 0.5
        
        # Project values using linear growth at half rate
        half_rate_df['totalSupplyAssets_formatted'] = [
            initial_supply + (supply_daily_growth_half * 14 * (i+1))
            for i in range(len(future_dates))
        ]
        
        half_rate_df['totalBorrowAssets_formatted'] = [
            initial_borrow + (borrow_daily_growth_half * 14 * (i+1))
            for i in range(len(future_dates))
        ]
        
        # Calculate derived metrics
        half_rate_df['availableLiquidity_formatted'] = half_rate_df['totalSupplyAssets_formatted'] - half_rate_df['totalBorrowAssets_formatted']
        
        # Plot neutral projections with yellow lines but distinct patterns
        ax.plot(half_rate_df['date'], half_rate_df['totalSupplyAssets_formatted'], 'y--', linewidth=2.5, marker='s', markersize=4, markevery=3, label='Neutral')
        ax.plot(half_rate_df['date'], half_rate_df['totalBorrowAssets_formatted'], color='y', linewidth=3.0, marker='s', markersize=5, markevery=3, 
                dashes=[5, 2, 1, 2], label='_nolegend_')  # Very distinctive pattern
        ax.plot(half_rate_df['date'], half_rate_df['availableLiquidity_formatted'], 'y:', linewidth=2, marker='s', markersize=4, markevery=3, alpha=0.7, label='_nolegend_')
        
        # Add annotation for neutral projected end values
        half_rate_end = half_rate_df.iloc[-1]
        ax.annotate(f"Neutral Supply: {half_rate_end['totalSupplyAssets_formatted']:,.2f}",
                    xy=(half_rate_end['date'], half_rate_end['totalSupplyAssets_formatted']),
                    xytext=(15, -60), textcoords='offset points', fontsize=11,
                    bbox=dict(boxstyle="round,pad=0.4", fc="white", ec="yellow", alpha=0.9))
        
        ax.annotate(f"Neutral Borrow: {half_rate_end['totalBorrowAssets_formatted']:,.2f}",
                    xy=(half_rate_end['date'], half_rate_end['totalBorrowAssets_formatted']),
                    xytext=(15, -90), textcoords='offset points', fontsize=11,
                    bbox=dict(boxstyle="round,pad=0.4", fc="white", ec="yellow", alpha=0.9))
        
        ax.annotate(f"Neutral Liquidity: {half_rate_end['availableLiquidity_formatted']:,.2f}",
                    xy=(half_rate_end['date'], half_rate_end['availableLiquidity_formatted']),
                    xytext=(15, -50), textcoords='offset points', fontsize=11,
                    bbox=dict(boxstyle="round,pad=0.4", fc="white", ec="yellow", alpha=0.9))
        
        # ---- Bearish Projection (Red) ----
        # Create bearish projections dataframe (10% of the growth rate)
        low_rate_df = pd.DataFrame()
        low_rate_df['date'] = future_dates
        
        # Calculate bearish growth
        supply_daily_growth_low = supply_daily_growth * 0.1
        borrow_daily_growth_low = borrow_daily_growth * 0.1
        
        # Project values using linear growth at low rate
        low_rate_df['totalSupplyAssets_formatted'] = [
            initial_supply + (supply_daily_growth_low * 14 * (i+1))
            for i in range(len(future_dates))
        ]
        
        low_rate_df['totalBorrowAssets_formatted'] = [
            initial_borrow + (borrow_daily_growth_low * 14 * (i+1))
            for i in range(len(future_dates))
        ]
        
        # Calculate derived metrics
        low_rate_df['availableLiquidity_formatted'] = low_rate_df['totalSupplyAssets_formatted'] - low_rate_df['totalBorrowAssets_formatted']
        
        # Plot bearish projections with red lines but distinct patterns
        ax.plot(low_rate_df['date'], low_rate_df['totalSupplyAssets_formatted'], 'r--', linewidth=2.5, marker='^', markersize=4, markevery=3, label='Bearish')
        ax.plot(low_rate_df['date'], low_rate_df['totalBorrowAssets_formatted'], color='r', linewidth=3.0, marker='^', markersize=5, markevery=3, 
                dashes=[5, 2, 1, 2], label='_nolegend_')  # Very distinctive pattern
        ax.plot(low_rate_df['date'], low_rate_df['availableLiquidity_formatted'], 'r:', linewidth=2, marker='^', markersize=4, markevery=3, alpha=0.7, label='_nolegend_')
        
        # Add annotation for bearish projected end values
        low_rate_end = low_rate_df.iloc[-1]
        ax.annotate(f"Bearish Supply: {low_rate_end['totalSupplyAssets_formatted']:,.2f}",
                    xy=(low_rate_end['date'], low_rate_end['totalSupplyAssets_formatted']),
                    xytext=(-240, 60), textcoords='offset points', fontsize=11,
                    bbox=dict(boxstyle="round,pad=0.4", fc="white", ec="red", alpha=0.9))
        
        ax.annotate(f"Bearish Borrow: {low_rate_end['totalBorrowAssets_formatted']:,.2f}",
                    xy=(low_rate_end['date'], low_rate_end['totalBorrowAssets_formatted']),
                    xytext=(15, 40), textcoords='offset points', fontsize=11,
                    bbox=dict(boxstyle="round,pad=0.4", fc="white", ec="red", alpha=0.9))
        
        ax.annotate(f"Bearish Liquidity: {low_rate_end['availableLiquidity_formatted']:,.2f}",
                    xy=(low_rate_end['date'], low_rate_end['availableLiquidity_formatted']),
                    xytext=(15, 80), textcoords='offset points', fontsize=11,
                    bbox=dict(boxstyle="round,pad=0.4", fc="white", ec="red", alpha=0.9))
    
    # Fill the area between curves (only for historical data)
    ax.fill_between(df['date'], df['totalBorrowAssets_formatted'], 0, color='red', alpha=0.2)
    ax.fill_between(df['date'], df['totalSupplyAssets_formatted'], df['totalBorrowAssets_formatted'], color='green', alpha=0.2)
    
    # Format the date axis
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=2))  # Show every other month
    
    # Rotate date labels to prevent overlap
    plt.setp(ax.get_xticklabels(), rotation=45, ha='right')
    
    # Add labels and title
    ax.set_xlabel('Date', fontsize=14)
    ax.set_ylabel('Amount (USDC)', fontsize=14)
    ax.set_title('cbBTC/USDC Market Growth Scenarios: Bullish, Neutral, and Bearish', fontsize=18)
    ax.legend(loc='upper left', fontsize=12)
    ax.grid(True)
    
    # Add a timestamp to the bottom of the figure
    plt.figtext(0.5, 0.02, f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
               ha="center", fontsize=10, bbox={"facecolor":"white", "alpha":0.7, "pad":5})
    
    # Adjust layout to make room for rotated labels
    plt.tight_layout(pad=3.0, rect=[0, 0.03, 1, 0.97])
    
    # Save the plot
    plt_filename = os.path.join(png_dir, "morpho_market_history_multiple_scenarios.png")
    plt.savefig(plt_filename, dpi=300, bbox_inches='tight')
    print(f"Plot saved to {plt_filename}")
    
    # Save as a high-quality SVG for vector format
    svg_filename = os.path.join(svg_dir, "morpho_market_history_multiple_scenarios.svg")
    plt.savefig(svg_filename, format='svg', bbox_inches='tight')
    print(f"Vector plot saved to {svg_filename}")
    
    # Add a clear summary of monthly growth rates before showing the plot
    if proj_df is not None:
        # Calculate monthly growth rates for all scenarios
        monthly_supply_growth_amount = supply_daily_growth * 30
        monthly_supply_growth_rate = (monthly_supply_growth_amount / initial_supply) * 100
        
        monthly_borrow_growth_amount = borrow_daily_growth * 30
        monthly_borrow_growth_rate = (monthly_borrow_growth_amount / initial_borrow) * 100
        
        # Calculate half rates (50%)
        monthly_supply_growth_amount_half = monthly_supply_growth_amount * 0.5
        monthly_supply_growth_rate_half = monthly_supply_growth_rate * 0.5
        
        monthly_borrow_growth_amount_half = monthly_borrow_growth_amount * 0.5
        monthly_borrow_growth_rate_half = monthly_borrow_growth_rate * 0.5
        
        # Calculate low rates (10%)
        monthly_supply_growth_amount_low = monthly_supply_growth_amount * 0.1
        monthly_supply_growth_rate_low = monthly_supply_growth_rate * 0.1
        
        monthly_borrow_growth_amount_low = monthly_borrow_growth_amount * 0.1
        monthly_borrow_growth_rate_low = monthly_borrow_growth_rate * 0.1
        
        print("\n=== Monthly Growth Rate Summary ===")
        print("--- Bullish Scenario ---")
        print(f"Supply Monthly Growth Amount: {monthly_supply_growth_amount:,.2f} USDC")
        print(f"Supply Monthly Growth Rate: {monthly_supply_growth_rate:.2f}%")
        print(f"Borrow Monthly Growth Amount: {monthly_borrow_growth_amount:,.2f} USDC")
        print(f"Borrow Monthly Growth Rate: {monthly_borrow_growth_rate:.2f}%")
        
        print("\n--- Neutral Scenario ---")
        print(f"Supply Monthly Growth Amount: {monthly_supply_growth_amount_half:,.2f} USDC")
        print(f"Supply Monthly Growth Rate: {monthly_supply_growth_rate_half:.2f}%")
        print(f"Borrow Monthly Growth Amount: {monthly_borrow_growth_amount_half:,.2f} USDC")
        print(f"Borrow Monthly Growth Rate: {monthly_borrow_growth_rate_half:.2f}%")
        
        print("\n--- Bearish Scenario ---")
        print(f"Supply Monthly Growth Amount: {monthly_supply_growth_amount_low:,.2f} USDC")
        print(f"Supply Monthly Growth Rate: {monthly_supply_growth_rate_low:.2f}%")
        print(f"Borrow Monthly Growth Amount: {monthly_borrow_growth_amount_low:,.2f} USDC")
        print(f"Borrow Monthly Growth Rate: {monthly_borrow_growth_rate_low:.2f}%")
    
    # Only show the plot if explicitly requested
    if args.show_plot:
        print("\nDisplaying plot window. Close the window to exit.")
        plt.show()
    else:
        # Close the plot to free memory and ensure termination
        plt.close(fig)
    
    print("\nAnalysis complete!")

if __name__ == "__main__":
    main() 