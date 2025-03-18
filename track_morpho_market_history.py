#!/usr/bin/env python3

import os
import time
import argparse
import pickle
from datetime import datetime
from web3 import Web3
from dotenv import load_dotenv
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
import seaborn as sns

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
CACHE_DIR = "cache"
CACHE_FILE = os.path.join(CACHE_DIR, "morpho_market_data.pickle")

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
    parser = argparse.ArgumentParser(description='Track Morpho market data over time')
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
    
    # Display the table
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
    
    # Save to CSV
    csv_filename = "morpho_market_history.csv"
    df.to_csv(csv_filename, index=False)
    print(f"\nData saved to {csv_filename}")
    
    # Create a figure with multiple subplots
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 12), gridspec_kw={'height_ratios': [2, 1]})
    
    # Plot 1: Supply and Borrow Assets
    ax1.plot(df['date'], df['totalSupplyAssets_formatted'], 'b-', linewidth=2.5, label='Total Supply (USDC)')
    ax1.plot(df['date'], df['totalBorrowAssets_formatted'], 'r-', linewidth=2.5, label='Total Borrow (USDC)')
    ax1.plot(df['date'], df['availableLiquidity_formatted'], 'g-', linewidth=2, alpha=0.7, label='Available Liquidity (USDC)')
    
    # Fill the area between curves
    ax1.fill_between(df['date'], df['totalBorrowAssets_formatted'], 0, color='red', alpha=0.2)
    ax1.fill_between(df['date'], df['totalSupplyAssets_formatted'], df['totalBorrowAssets_formatted'], color='green', alpha=0.2)
    
    # Format the date axis
    ax1.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    ax1.xaxis.set_major_locator(mdates.MonthLocator())
    
    # Add labels and title
    ax1.set_xlabel('Date')
    ax1.set_ylabel('Amount (USDC)')
    ax1.set_title('cbBTC/USDC Market - Supply and Borrow Assets Over Time', fontsize=16)
    ax1.legend(loc='upper left')
    ax1.grid(True)
    
    # Add annotation for latest values
    latest = df.iloc[-1]
    ax1.annotate(f"Supply: {latest['totalSupplyAssets_formatted']:,.2f}",
                xy=(latest['date'], latest['totalSupplyAssets_formatted']),
                xytext=(10, 10), textcoords='offset points',
                bbox=dict(boxstyle="round,pad=0.3", fc="white", ec="blue", alpha=0.8))
    
    ax1.annotate(f"Borrow: {latest['totalBorrowAssets_formatted']:,.2f}",
                xy=(latest['date'], latest['totalBorrowAssets_formatted']),
                xytext=(10, -20), textcoords='offset points',
                bbox=dict(boxstyle="round,pad=0.3", fc="white", ec="red", alpha=0.8))
    
    ax1.annotate(f"Available: {latest['availableLiquidity_formatted']:,.2f}",
                xy=(latest['date'], latest['availableLiquidity_formatted']),
                xytext=(10, 10), textcoords='offset points',
                bbox=dict(boxstyle="round,pad=0.3", fc="white", ec="green", alpha=0.8))
    
    # Plot 2: Utilization Rate
    ax2.plot(df['date'], df['utilization_rate'], 'purple', linewidth=2.5)
    ax2.fill_between(df['date'], df['utilization_rate'], 0, color='purple', alpha=0.2)
    
    # Format the date axis
    ax2.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    ax2.xaxis.set_major_locator(mdates.MonthLocator())
    
    # Add labels
    ax2.set_xlabel('Date')
    ax2.set_ylabel('Utilization Rate (%)')
    ax2.set_title('cbBTC/USDC Market - Utilization Rate Over Time', fontsize=16)
    ax2.grid(True)
    
    # Add annotation for latest utilization rate
    ax2.annotate(f"Current: {latest['utilization_rate']:.2f}%",
                xy=(latest['date'], latest['utilization_rate']),
                xytext=(10, 10), textcoords='offset points',
                bbox=dict(boxstyle="round,pad=0.3", fc="white", ec="purple", alpha=0.8))
    
    # Set y-axis limits to make sure it starts at 0 and ends at 100% or slightly higher
    max_util = max(df['utilization_rate']) * 1.1
    ax2.set_ylim(0, min(max_util, 105))  # Cap at 105% for visualization
    
    # Adjust layout and spacing
    plt.tight_layout()
    fig.subplots_adjust(hspace=0.3)
    
    # Add a timestamp to the bottom of the figure
    plt.figtext(0.5, 0.01, f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
               ha="center", fontsize=10, bbox={"facecolor":"white", "alpha":0.7, "pad":5})
    
    # Save the plot
    plt_filename = "morpho_market_history.png"
    plt.savefig(plt_filename, dpi=300, bbox_inches='tight')
    print(f"Plot saved to {plt_filename}")
    
    # Save as a high-quality SVG for vector format
    svg_filename = "morpho_market_history.svg"
    plt.savefig(svg_filename, format='svg', bbox_inches='tight')
    print(f"Vector plot saved to {svg_filename}")
    
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