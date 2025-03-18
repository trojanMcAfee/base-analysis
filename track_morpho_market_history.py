#!/usr/bin/env python3

import os
import time
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

def main():
    # Set the style for plots
    sns.set_style("whitegrid")
    plt.rcParams.update({'font.size': 12})
    
    # Connect to Base network
    w3 = Web3(Web3.HTTPProvider(BASE_RPC_URL))
    
    # Check connection
    if not w3.is_connected():
        print("Failed to connect to Base network")
        return
    
    print(f"Connected to Base network. Current block: {w3.eth.block_number}")
    
    # Create contract instance
    morpho_contract = w3.eth.contract(address=MORPHO_ADDRESS, abi=ABI)
    
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
    
    # Display the plot (optional if running in an environment that supports it)
    plt.show()

if __name__ == "__main__":
    main() 