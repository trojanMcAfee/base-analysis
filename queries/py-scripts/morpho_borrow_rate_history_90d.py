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
SUBGRAPH_ID = '71ZTy1veF9twER9CLMnPWeLQ7GZcwKsjmygejrgKirqs'

# Constants for script
CURRENT_BLOCK = 28148464  # March 27th, 2024
DAYS_TO_LOOK_BACK = 90
INTERVAL_DAYS = 7  # Query every 7 days
BLOCKS_PER_DAY = 43200  # Approximately for Base chain (0.5s block time)

# Get subgraph endpoint from environment
def get_base_subgraph_endpoint():
    api_key = os.getenv('THE_GRAPH_API_KEY')
    if not api_key:
        print("Warning: THE_GRAPH_API_KEY not found in environment variables")
        print("Please ensure .env.private file contains THE_GRAPH_API_KEY=your_api_key")
        # Check if you provided a value in the error message and ask for input
        api_key = input("Enter your The Graph API key (or press Enter to exit): ")
        if not api_key:
            print("No API key provided, exiting")
            sys.exit(1)
        os.environ['THE_GRAPH_API_KEY'] = api_key
    
    return f"https://gateway.thegraph.com/api/{api_key}/subgraphs/id/{SUBGRAPH_ID}"

# Function to make a GraphQL request
def make_graphql_request(query, variables=None):
    if variables is None:
        variables = {}
    
    try:
        response = requests.post(
            get_base_subgraph_endpoint(),
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

# Function to fetch borrowing rate for a specific block
def fetch_borrowing_rate(market_id, block_number):
    block_param = f", block: {{ number: {block_number} }}" if block_number else ""
    
    query = f"""
    {{
      market(id: "{market_id}"{block_param}) {{
        id
        rates {{
          rate
          side
          type
        }}
      }}
    }}
    """
    
    return make_graphql_request(query)

# Function to calculate blocks from days ago
def blocks_from_days_ago(days_ago, current_block):
    return current_block - (days_ago * BLOCKS_PER_DAY)

# Main function
def main():
    print("Fetching Morpho borrowing rate history over 90 days at 7-day intervals")
    
    # Calculate block numbers for each interval
    intervals = []
    for days_ago in range(0, DAYS_TO_LOOK_BACK + 1, INTERVAL_DAYS):
        block_number = blocks_from_days_ago(days_ago, CURRENT_BLOCK)
        date = (datetime.now() - timedelta(days=days_ago)).strftime('%Y-%m-%d')
        intervals.append({
            'days_ago': days_ago,
            'block_number': block_number,
            'date': date
        })
    
    # Reverse so we go from earliest to latest
    intervals.reverse()
    
    # Fetch borrowing rates for each interval
    results = []
    
    for interval in intervals:
        block_number = interval['block_number']
        date = interval['date']
        days_ago = interval['days_ago']
        
        print(f"Querying block {block_number} ({days_ago} days ago - {date})...")
        
        # Add delay to avoid rate limiting
        if len(results) > 0:
            time.sleep(1)
        
        data = fetch_borrowing_rate(CBBTC_USDC_MARKET_ID, block_number)
        
        if data is None:
            print(f"Failed to query data for block {block_number}")
            continue
            
        if not data.get('market'):
            print(f"Market did not exist at block {block_number} (possibly before market creation)")
            continue
            
        if not data['market'].get('rates'):
            print(f"No rates found for market at block {block_number}")
            continue
        
        # Look for the borrow rate (side: BORROWER, type: VARIABLE)
        borrow_rate = next(
            (rate for rate in data['market']['rates'] 
             if rate['side'] == 'BORROWER' and rate['type'] == 'VARIABLE'),
            None
        )
        
        if borrow_rate:
            # Convert to percentage
            borrow_rate_percentage = float(borrow_rate['rate']) * 100
            print(f"Borrow rate: {borrow_rate_percentage:.2f}%")
            
            results.append({
                'block_number': block_number,
                'date': date,
                'days_ago': DAYS_TO_LOOK_BACK - days_ago,  # Invert for plotting
                'borrow_rate': borrow_rate_percentage
            })
        else:
            print(f"No borrowing rate found for block {block_number}")
    
    # Create DataFrame from results
    if not results:
        print("No data collected. Exiting.")
        return
        
    df = pd.DataFrame(results)
    
    # Convert date to datetime for better plotting
    df['date'] = pd.to_datetime(df['date'])
    
    # Set output directory
    output_dir = root_dir / 'plots' / 'png'
    output_dir.mkdir(exist_ok=True, parents=True)
    
    # Save to CSV
    csv_path = output_dir / 'morpho_borrow_rate_history_90d.csv'
    df.to_csv(csv_path, index=False)
    print(f"Data saved to {csv_path}")
    
    # Plot results
    print("Generating plot...")
    plot_borrow_rate_history(df, output_dir)
    
def plot_borrow_rate_history(df, output_dir):
    # Set style
    sns.set_style('whitegrid')
    plt.figure(figsize=(12, 6))
    
    # Create plot
    ax = sns.lineplot(x='date', y='borrow_rate', data=df, marker='o', linewidth=2)
    
    # Set labels and title
    plt.title('Morpho cbBTC/USDC Market Borrowing Rate History (Last 90 Days)', fontsize=16)
    plt.xlabel('Date', fontsize=12)
    plt.ylabel('Borrowing Rate (%)', fontsize=12)
    
    # Format x-axis dates
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    plt.xticks(rotation=45)
    
    # Add grid
    plt.grid(True, alpha=0.3)
    
    # Annotate the latest rate
    latest = df.iloc[-1]
    plt.annotate(f"{latest['borrow_rate']:.2f}%", 
                xy=(latest['date'], latest['borrow_rate']),
                xytext=(10, 10),
                textcoords='offset points',
                fontsize=10,
                bbox=dict(boxstyle='round,pad=0.5', fc='yellow', alpha=0.5))
    
    # Ensure everything fits
    plt.tight_layout()
    
    # Save the plot
    output_path = output_dir / 'morpho_borrow_rate_history_90d.png'
    plt.savefig(output_path)
    print(f"Plot saved to {output_path}")
    
    # Show the plot
    plt.show()

# Execute the main function
if __name__ == "__main__":
    main() 