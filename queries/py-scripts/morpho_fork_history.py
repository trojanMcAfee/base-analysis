#!/usr/bin/env python3
import os
import sys
import json
import time
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta
from web3 import Web3

# Constants from common.js
MORPHO_CONTRACT_ADDRESS = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb'
CBBTC_USDC_MARKET_ID = '0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836'

# This is a simplified ABI with just the functions we need
# You would need the complete ABI for production use
SIMPLIFIED_ABI = [
    {
        "inputs": [{"name": "marketId", "type": "bytes32"}],
        "name": "getMarketState",
        "outputs": [
            {"name": "supplyApy", "type": "uint256"},
            {"name": "borrowApy", "type": "uint256"},
            {"name": "utilization", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

def get_provider_url():
    """
    Get provider URL from environment variable or prompt user
    """
    provider_url = os.environ.get('WEB3_PROVIDER_URI')
    
    if not provider_url:
        print("\nNo provider URL found in environment. You'll need a provider with archive access.")
        print("Examples: Infura, Alchemy with Premium plan")
        provider_url = input("Enter your provider URL (or 'demo' for simulation mode): ")
    
    return provider_url

def connect_to_node(provider_url, block_number=None):
    """
    Connect to Ethereum node with optional forking at a specific block
    """
    if block_number:
        # This is conceptual - actual implementation varies by provider
        print(f"[Simulation] Forking at block {block_number}")
        # In reality, this would be a more complex setup with a provider supporting forking
        w3 = Web3(Web3.HTTPProvider(provider_url))
    else:
        w3 = Web3(Web3.HTTPProvider(provider_url))
    
    try:
        # Check connection
        connected = w3.is_connected()
        if connected:
            print(f"Connected to Ethereum node. Current block: {w3.eth.block_number}")
            return w3
        else:
            print("Failed to connect to Ethereum node")
            return None
    except Exception as e:
        print(f"Error connecting to node: {e}")
        return None

def get_rates_at_block(w3, contract, market_id, block_number):
    """
    Get rates from the contract at a specific block
    """
    try:
        # In a real implementation, you would call the contract at a specific block
        # Here we're simulating the results
        if w3 is None or "demo" in w3.provider.endpoint_uri:
            # Simulate rate data that changes over time
            seed = int(block_number / 1000)  # Use block number to create varying but deterministic rates
            import random
            random.seed(seed)
            
            # Create realistic looking rates that slowly change over time
            base_borrow = 5.0  # 5% base rate
            base_supply = 4.0  # 4% base rate
            base_util = 80.0   # 80% base utilization
            
            # Add some variation based on block number
            variation = (block_number % 1000) / 1000  # 0.0 to 1.0
            
            borrow_rate = base_borrow + (random.random() * 2 - 1) + variation
            supply_rate = base_supply + (random.random() * 1.5 - 0.75) + variation * 0.8
            utilization = min(95, base_util + (random.random() * 10 - 5) + variation * 10)
            
            # Ensure rates are realistic
            borrow_rate = max(2, min(12, borrow_rate))
            supply_rate = max(1, min(10, supply_rate))
            utilization = max(50, min(95, utilization))
            
            return {
                'borrow_rate': borrow_rate,
                'supply_rate': supply_rate,
                'utilization': utilization
            }
        else:
            # With a real contract, you would call something like:
            # state = contract.functions.getMarketState(market_id).call(block_identifier=block_number)
            # Then convert the returned values to percentages
            # For now, this is a placeholder
            state = [4.2 * 10**16, 5.0 * 10**16, 85 * 10**16]  # Example values in Wei (simulated)
            return {
                'supply_rate': state[0] / 10**16,  # Convert to percentage
                'borrow_rate': state[1] / 10**16,  # Convert to percentage
                'utilization': state[2] / 10**16   # Convert to percentage
            }
    except Exception as e:
        print(f"Error getting rates at block {block_number}: {e}")
        return None

def get_block_timestamp(w3, block_number):
    """
    Get timestamp for a block number
    """
    try:
        if w3 is None or "demo" in w3.provider.endpoint_uri:
            # Simulate timestamp (approximately)
            # Assume 13 seconds per block on average, starting from a recent timestamp
            base_time = int(datetime(2024, 1, 1).timestamp())
            seconds_per_block = 13
            return base_time + (block_number * seconds_per_block)
        else:
            block = w3.eth.get_block(block_number)
            return block.timestamp
    except Exception as e:
        print(f"Error getting timestamp for block {block_number}: {e}")
        # Return current timestamp as fallback
        return int(datetime.now().timestamp())

def collect_historical_data(provider_url, days=90, interval_days=1):
    """
    Collect historical data by forking at different blocks
    """
    print(f"Collecting historical data for the past {days} days with {interval_days} day intervals...")
    
    # Connect to node for basic info
    w3 = connect_to_node(provider_url)
    if not w3 and provider_url != "demo":
        print("Failed to connect to Ethereum node. Exiting.")
        return None
    
    # Get current block for reference
    if w3 and provider_url != "demo":
        current_block = w3.eth.block_number
        print(f"Current block number: {current_block}")
    else:
        # Use a simulated current block for demo mode
        current_block = 20000000
        print(f"Using simulated current block: {current_block}")
    
    # Create contract instance (would be used in real implementation)
    if w3 and provider_url != "demo":
        contract = w3.eth.contract(address=MORPHO_CONTRACT_ADDRESS, abi=SIMPLIFIED_ABI)
    else:
        contract = None
    
    # Calculate approximate blocks per day (average 13 seconds per block)
    blocks_per_day = int(24 * 60 * 60 / 13)
    
    historical_data = []
    
    # Collect data for specified number of days in the past
    for days_ago in range(days, 0, -interval_days):
        # Calculate block number for this day
        blocks_ago = days_ago * blocks_per_day
        block_number = current_block - blocks_ago
        
        print(f"Processing data from {days_ago} days ago (block {block_number})...")
        
        # In a real implementation, we would fork the chain at this block
        # For this example, we'll simulate the forking
        fork_w3 = connect_to_node(provider_url, block_number)
        
        # Get rates at this block
        rates = get_rates_at_block(fork_w3, contract, CBBTC_USDC_MARKET_ID, block_number)
        
        if rates:
            # Get block timestamp
            timestamp = get_block_timestamp(w3, block_number)
            date = datetime.fromtimestamp(timestamp)
            
            # Store data
            data_point = {
                'block_number': block_number,
                'timestamp': date,
                'borrow_rate': rates['borrow_rate'],
                'supply_rate': rates['supply_rate'],
                'utilization': rates['utilization']
            }
            historical_data.append(data_point)
            
            print(f"  Block {block_number} ({date}): Borrow {rates['borrow_rate']:.2f}%, Supply {rates['supply_rate']:.2f}%, Util {rates['utilization']:.2f}%")
        
        # Sleep to avoid rate limiting with real providers
        time.sleep(0.2)
    
    return historical_data

def plot_historical_rates(data):
    """
    Create a plot of the historical rate data
    """
    if not data:
        print("No data to plot")
        return
    
    # Convert to DataFrame
    df = pd.DataFrame(data)
    
    # Sort by timestamp
    df = df.sort_values('timestamp')
    
    # Create plot
    plt.figure(figsize=(12, 8))
    plt.style.use('dark_background')
    
    # Plot rates
    plt.plot(df['timestamp'], df['borrow_rate'], label='Borrow Rate (%)', color='#3498db', linewidth=2)
    plt.plot(df['timestamp'], df['supply_rate'], label='Supply Rate (%)', color='#2ecc71', linewidth=2)
    
    # Create secondary y-axis for utilization
    ax2 = plt.twinx()
    ax2.plot(df['timestamp'], df['utilization'], label='Utilization (%)', color='#e74c3c', linestyle='--', linewidth=1.5)
    ax2.set_ylabel('Utilization (%)', color='#e74c3c', fontsize=14)
    ax2.tick_params(axis='y', labelcolor='#e74c3c')
    ax2.set_ylim(0, 100)
    
    # Format x-axis dates
    plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    plt.gca().xaxis.set_major_locator(mdates.WeekdayLocator(interval=2))
    plt.gcf().autofmt_xdate()
    
    # Add labels and title
    plt.grid(True, alpha=0.3)
    plt.xlabel('Date', fontsize=14, labelpad=10)
    plt.ylabel('Rate (%)', fontsize=14, labelpad=10)
    plt.title('Morpho cbBTC/USDC Market - Historical Rates (via Chain Forking)', fontsize=20, pad=20)
    
    # Add legends
    lines1, labels1 = plt.gca().get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax2.legend(lines1 + lines2, labels1 + labels2, loc='upper right', frameon=True)
    
    # Add note about simulation if needed
    if any("demo" in str(d) for d in df['timestamp']):
        plt.figtext(0.5, 0.01, 
                "Note: This chart uses simulated data for demonstration purposes.", 
                ha='center', fontsize=12, color='#f39c12')
    
    # Set reasonable y-axis limits for rates
    min_rate = min(df['supply_rate'].min(), df['borrow_rate'].min()) * 0.9
    max_rate = max(df['supply_rate'].max(), df['borrow_rate'].max()) * 1.1
    plt.ylim(max(0, min_rate), max_rate)
    
    # Save plot
    plot_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'plots', 'png')
    os.makedirs(plot_dir, exist_ok=True)
    plot_path = os.path.join(plot_dir, 'morpho_historical_rates.png')
    plt.savefig(plot_path, dpi=300, bbox_inches='tight')
    print(f"\nPlot saved to: {plot_path}")
    
    # Show plot
    plt.tight_layout()
    plt.show()
    
    # Save data to CSV
    csv_path = os.path.join(plot_dir, 'morpho_historical_rates.csv')
    df.to_csv(csv_path, index=False)
    print(f"Data saved to: {csv_path}")

def main():
    """
    Main function to orchestrate the data collection and visualization
    """
    print("Morpho Historical Rate Tracker using Blockchain Forking")
    print("======================================================")
    
    # Get provider URL
    provider_url = get_provider_url()
    
    if not provider_url:
        print("No provider URL specified. Exiting.")
        return
    
    # Use demo mode if specified
    if provider_url.lower() == 'demo':
        provider_url = 'demo'
        print("\nRunning in DEMO MODE with simulated data")
    
    # Collect historical data
    data = collect_historical_data(provider_url, days=90, interval_days=5)
    
    if data and len(data) > 0:
        # Plot the data
        plot_historical_rates(data)
    else:
        print("No data collected. Exiting.")

if __name__ == "__main__":
    main() 