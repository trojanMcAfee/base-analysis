import os
import requests
import json
import time
import sys
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta
import seaborn as sns
from pathlib import Path
import numpy as np
from calendar import monthrange

# Function to load environment variables from a .env file
def load_env_file(env_path):
    if not os.path.exists(env_path):
        print(f"Warning: {env_path} not found")
        return
    
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            try:
                key, value = line.split('=', 1)
                os.environ[key] = value
            except ValueError:
                print(f"Warning: Could not parse line: {line}")

# Set up paths
script_dir = Path(__file__).parent
root_dir = script_dir.parent.parent

# Try to use python-dotenv if available
try:
    from dotenv import load_dotenv
    load_dotenv(root_dir / '.env.private')
    print("Loaded environment using python-dotenv")
except ImportError:
    # Fall back to custom implementation
    load_env_file(root_dir / '.env.private')
    print("Loaded environment using custom implementation")

# Constants from common.js
CBBTC_USDC_MARKET_ID = '0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836'

# Constants for script
CURRENT_BLOCK = 28399000  # Current block on Base chain (April 2024)
MONTHS_TO_LOOK_BACK = 3   # Changed from 12 to 3 months
BLOCKS_PER_DAY = 43200    # Approximately for Base chain (0.5s block time)

# More granular tracking - weekly intervals instead of monthly
DAYS_PER_INTERVAL = 7     # Query data every week
BLOCKS_PER_INTERVAL = BLOCKS_PER_DAY * DAYS_PER_INTERVAL

# Get subgraph endpoint from environment
def get_subgraph_endpoint():
    api_url = os.getenv('GOLDSKY_API_URL')
    if not api_url:
        print("Warning: GOLDSKY_API_URL not found in environment variables")
        print("Please ensure .env.private file contains GOLDSKY_API_URL")
        # Ask for input
        api_url = input("Enter your Goldsky API URL (or press Enter to exit): ")
        if not api_url:
            print("No API URL provided, exiting")
            sys.exit(1)
        os.environ['GOLDSKY_API_URL'] = api_url
    
    return api_url

# Function to make a GraphQL request
def make_graphql_request(query, variables=None):
    if variables is None:
        variables = {}
    
    try:
        response = requests.post(
            get_subgraph_endpoint(),
            json={'query': query, 'variables': variables},
            headers={'Content-Type': 'application/json', 'Accept': 'application/json'}
        )
        
        if response.status_code != 200:
            print(f"Error: HTTP Status {response.status_code}")
            print(response.text)
            return None
            
        data = response.json()
        
        if 'errors' in data:
            print('GraphQL Errors:', data['errors'])
            return None
            
        return data['data']
    except Exception as e:
        print(f"Error making request: {e}")
        return None

# Function to fetch market data for a specific block
def fetch_market_data(market_id, block_number):
    block_param = f", block: {{ number: {block_number} }}" if block_number else ""
    
    query = f"""
    {{
      market(id: "{market_id}"{block_param}) {{
        id
        borrowedToken {{
          symbol
          decimals
        }}
        totalSupply
        totalBorrow
      }}
    }}
    """
    
    return make_graphql_request(query)

# Main function
def main():
    print("Fetching Morpho supply & borrow data over the past 3 months")
    
    # Calculate intervals for data collection
    intervals = []
    
    # Get the current date
    now = datetime.now()
    
    # Calculate total days to look back
    days_to_look_back = 90  # Approximately 3 months
    
    # Create intervals for every week over the past 3 months
    for days_ago in range(0, days_to_look_back + 1, DAYS_PER_INTERVAL):
        # Calculate block number
        block_number = CURRENT_BLOCK - (days_ago * BLOCKS_PER_DAY)
        
        # Calculate the date for this block
        target_date = now - timedelta(days=days_ago)
        date = target_date.strftime("%Y-%m-%d")
        
        intervals.append({
            'days_ago': days_ago,
            'block_number': block_number,
            'date': date
        })
    
    # Sort intervals from oldest to newest
    intervals.sort(key=lambda x: x['block_number'])
    
    # Fetch market data for each interval
    results = []
    
    for interval in intervals:
        block_number = interval['block_number']
        date = interval['date']
        days_ago = interval['days_ago']
        
        print(f"Querying block {block_number} ({days_ago} days ago - {date})...")
        
        # Add delay to avoid rate limiting
        if len(results) > 0:
            time.sleep(1)
        
        data = fetch_market_data(CBBTC_USDC_MARKET_ID, block_number)
        
        if data is None:
            print(f"Failed to query data for block {block_number}")
            continue
            
        if not data.get('market'):
            print(f"Market did not exist at block {block_number} (possibly before market creation)")
            continue
        
        market = data['market']
        
        # Calculate available liquidity
        total_supply = float(market['totalSupply'])
        total_borrow = float(market['totalBorrow'])
        available_liquidity = total_supply - total_borrow
        loan_decimals = int(market['borrowedToken']['decimals']) if market['borrowedToken'] else 6  # Default to 6 for USDC
        
        # Convert from raw to decimal
        total_supply_decimal = total_supply / (10 ** loan_decimals)
        total_borrow_decimal = total_borrow / (10 ** loan_decimals)
        available_liquidity_decimal = available_liquidity / (10 ** loan_decimals)
        
        print(f"Total Supply: {total_supply_decimal:,.2f} USDC")
        print(f"Total Borrow: {total_borrow_decimal:,.2f} USDC")
        print(f"Available Liquidity: {available_liquidity_decimal:,.2f} USDC")
        
        results.append({
            'block_number': block_number,
            'date': date,
            'days_ago': days_ago,
            'total_supply': total_supply_decimal,
            'total_borrow': total_borrow_decimal,
            'available_liquidity': available_liquidity_decimal
        })
    
    # Create DataFrame from results
    if not results:
        print("No data collected. Exiting.")
        return
        
    df = pd.DataFrame(results)
    
    # Convert date to datetime for better plotting
    df['date'] = pd.to_datetime(df['date'])
    
    # Sort by date for proper chronological plotting
    df = df.sort_values('date')
    
    # Set output directory
    output_dir = root_dir / 'plots' / 'png'
    output_dir.mkdir(exist_ok=True, parents=True)
    
    # Save to CSV
    csv_path = output_dir / 'morpho_supply_borrow_history_3m.csv'
    df.to_csv(csv_path, index=False)
    print(f"Data saved to {csv_path}")
    
    # Plot results
    print("Generating plot...")
    plot_supply_borrow_history(df, output_dir)
    
def plot_supply_borrow_history(df, output_dir):
    # --- Data Scaling --- 
    # Scale data to millions
    df['total_borrow'] = df['total_borrow'] / 1_000_000
    df['available_liquidity'] = df['available_liquidity'] / 1_000_000
    # -------------------

    # Set style
    sns.set_style('whitegrid')
    
    # Create plot with two y-axes
    fig, ax1 = plt.subplots(figsize=(14, 8))
    
    # Set color palette
    colors = sns.color_palette("Set1")
    
    # First y-axis for Total Borrow (scaled)
    total_borrow_line = ax1.plot(df['date'], df['total_borrow'], color=colors[0], marker='o', linewidth=2, label='Total Borrow')
    ax1.set_xlabel('Date', fontsize=12)
    ax1.set_ylabel('Total Borrow (Millions of USDC)', fontsize=12, color=colors[0])
    ax1.tick_params(axis='y', labelcolor=colors[0])
    
    # Format x-axis dates - use more precise format for shorter timeframe
    ax1.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    plt.xticks(rotation=45)
    
    # Create second y-axis for Available Liquidity (scaled)
    ax2 = ax1.twinx()
    
    # Plot Available Liquidity on the second axis (scaled)
    available_liq_line = ax2.plot(df['date'], df['available_liquidity'], color=colors[1], marker='s', linewidth=2, label='Available Liquidity')
    ax2.set_ylabel('Available Liquidity (Millions of USDC)', fontsize=12, color=colors[1])
    ax2.tick_params(axis='y', labelcolor=colors[1])
    
    # Set y-axis limits based on scaled data ranges plus a margin
    ax1_min_val = df['total_borrow'].min()
    ax1_max_val = df['total_borrow'].max()
    ax1_margin = (ax1_max_val - ax1_min_val) * 0.1 # 10% margin
    ax1.set_ylim(max(0, ax1_min_val - ax1_margin), ax1_max_val + ax1_margin)
    
    ax2_min_val = df['available_liquidity'].min()
    ax2_max_val = df['available_liquidity'].max()
    ax2_margin = (ax2_max_val - ax2_min_val) * 0.1 # 10% margin
    ax2.set_ylim(max(0, ax2_min_val - ax2_margin), ax2_max_val + ax2_margin)
    
    # Combine legends from both axes
    lines = total_borrow_line + available_liq_line
    labels = [l.get_label() for l in lines]
    ax1.legend(lines, labels, loc='upper left')
    
    # Set title
    plt.title('Morpho cbBTC/USDC Market - Total Borrow & Available Liquidity (Last 3 Months)', fontsize=16)
    
    # Add grid
    ax1.grid(True, alpha=0.3)
    
    # Annotate the latest values (scaled)
    latest = df.iloc[-1]
    
    # Annotate Total Borrow (scaled)
    ax1.annotate(f"{latest['total_borrow']:,.2f} M USDC",
                xy=(latest['date'], latest['total_borrow']),
                xytext=(10, 10),
                textcoords='offset points',
                fontsize=10,
                color=colors[0],
                bbox=dict(boxstyle='round,pad=0.5', fc='white', alpha=0.8))
    
    # Annotate Available Liquidity (scaled)
    ax2.annotate(f"{latest['available_liquidity']:,.2f} M USDC",
                xy=(latest['date'], latest['available_liquidity']),
                xytext=(10, -20),
                textcoords='offset points',
                fontsize=10,
                color=colors[1],
                bbox=dict(boxstyle='round,pad=0.5', fc='white', alpha=0.8))
    
    # Save the plot as PNG
    output_path = output_dir / 'morpho_supply_borrow_history_3m.png'
    plt.savefig(output_path)
    print(f"PNG plot saved to {output_path}")
    
    # Save the plot as SVG
    svg_dir = root_dir / 'plots' / 'svg'
    svg_dir.mkdir(exist_ok=True, parents=True)
    svg_path = svg_dir / 'morpho_supply_borrow_history_3m.svg'
    plt.savefig(svg_path, format='svg')
    print(f"SVG plot saved to {svg_path}")
    
    # Ensure everything fits
    plt.tight_layout()
    
    # Show the plot
    plt.show()

# Execute the main function
if __name__ == "__main__":
    main() 