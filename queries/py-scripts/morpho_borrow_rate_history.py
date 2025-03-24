#!/usr/bin/env python3
import requests
import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta
import os

# Constants from common.js
MORPHO_GRAPHQL_ENDPOINT = 'https://blue-api.morpho.org/graphql'
GRAPHQL_MARKET_ID = 'f6bdf547-ff28-429b-b81d-d98574a6fbcd'  # cbBTC/USDC market
CBBTC_USDC_MARKET_ID = '0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836' # Hex format

def make_graphql_request(query, variables=None):
    """
    Function to make a GraphQL request to the Morpho API
    """
    if variables is None:
        variables = {}
    
    try:
        response = requests.post(
            MORPHO_GRAPHQL_ENDPOINT,
            json={'query': query, 'variables': variables},
            headers={'Content-Type': 'application/json'}
        )
        
        # Print response for debugging
        print(f"Response status: {response.status_code}")
        
        response.raise_for_status()  # Raise exception for HTTP errors
        data = response.json()
        
        if 'errors' in data:
            print('GraphQL Errors:', data['errors'])
            raise Exception('GraphQL request failed')
            
        return data.get('data')
    
    except Exception as e:
        print(f'Error making request: {e}')
        if hasattr(e, 'response') and hasattr(e.response, 'text'):
            print(f'Response text: {e.response.text}')
        raise

def fetch_market_history(market_id, days=30):
    """
    Fetch historical market data including borrow rates
    """
    # Calculate timestamp for the start date (X days ago)
    start_timestamp = int((datetime.now() - timedelta(days=days)).timestamp())
    
    # Try with a simpler query format that doesn't use UUID type
    query = """
    query {
      marketHistory(
        marketId: "%s"
        startTimestamp: %d
        interval: HOURLY
      ) {
        timestamp
        supplyRate
        borrowRate
        utilization
      }
    }
    """ % (market_id, start_timestamp)
    
    return make_graphql_request(query)

def fetch_market_rates():
    """
    Alternative approach to fetch market rates using a different query structure
    """
    query = """
    query {
      markets {
        items {
          id
          uniqueKey
          supplyRate
          borrowRate
          utilization
        }
      }
    }
    """
    
    data = make_graphql_request(query)
    
    # Find our specific market
    if data and 'markets' in data and 'items' in data['markets']:
        for market in data['markets']['items']:
            if market.get('uniqueKey') == CBBTC_USDC_MARKET_ID:
                print(f"Found market with ID: {market['id']}")
                return market
    
    return None

def prepare_data_for_plotting(history_data):
    """
    Prepare the data for plotting by converting to a DataFrame
    """
    if not history_data or 'marketHistory' not in history_data:
        raise Exception("No market history data available")
    
    # Convert the data to a pandas DataFrame
    data = []
    for entry in history_data['marketHistory']:
        # Convert timestamp to datetime and rates to percentages
        timestamp = datetime.fromtimestamp(int(entry['timestamp']))
        supply_rate = float(entry.get('supplyRate', 0)) * 100  # Convert to percentage
        borrow_rate = float(entry.get('borrowRate', 0)) * 100  # Convert to percentage
        utilization = float(entry.get('utilization', 0)) * 100  # Convert to percentage
        
        data.append({
            'timestamp': timestamp,
            'supply_rate': supply_rate,
            'borrow_rate': borrow_rate,
            'utilization': utilization
        })
    
    return pd.DataFrame(data)

def plot_borrow_rate_history(df):
    """
    Create a plot of the historical borrow rate
    """
    plt.figure(figsize=(12, 8))
    plt.style.use('dark_background')
    
    # Plot borrow rate
    plt.plot(df['timestamp'], df['borrow_rate'], label='Borrow Rate (%)', color='#3498db', linewidth=2)
    
    # Plot supply rate
    plt.plot(df['timestamp'], df['supply_rate'], label='Supply Rate (%)', color='#2ecc71', linewidth=2)
    
    # Create a secondary y-axis for utilization
    ax2 = plt.twinx()
    ax2.plot(df['timestamp'], df['utilization'], label='Utilization (%)', color='#e74c3c', linestyle='--', linewidth=1.5)
    ax2.set_ylabel('Utilization (%)', color='#e74c3c', fontsize=14)
    ax2.tick_params(axis='y', labelcolor='#e74c3c')
    ax2.set_ylim(0, 100)  # Utilization is a percentage
    
    # Format the x-axis to show dates nicely
    plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    plt.gca().xaxis.set_major_locator(mdates.DayLocator(interval=5))
    plt.gcf().autofmt_xdate()
    
    # Add labels and title
    plt.grid(True, alpha=0.3)
    plt.xlabel('Date', fontsize=14, labelpad=10)
    plt.ylabel('Rate (%)', fontsize=14, labelpad=10)
    plt.title('Morpho cbBTC/USDC Market - Borrow Rate History', fontsize=20, pad=20)
    
    # Add both legends
    lines, labels = plt.gca().get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax2.legend(lines + lines2, labels + labels2, loc='upper left', frameon=True)
    
    # Ensure tight layout
    plt.tight_layout()
    
    # Save to plots/png directory
    save_plot_to_file(plt, 'morpho_borrow_rate_history.png')
    
    # Show the plot
    plt.show()

def save_plot_to_file(plt, filename):
    """
    Save the plot to the plots/png directory
    """
    # Get the project root directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    
    # Create plots/png directory if it doesn't exist
    plot_dir = os.path.join(project_root, 'plots', 'png')
    os.makedirs(plot_dir, exist_ok=True)
    
    # Save the plot
    plot_path = os.path.join(plot_dir, filename)
    plt.savefig(plot_path, dpi=300, bbox_inches='tight')
    print(f"Plot saved to: {plot_path}")

def print_summary_statistics(df):
    """
    Print summary statistics for the borrow rate
    """
    print("\nBorrow Rate Statistics:")
    print(f"Average borrow rate: {df['borrow_rate'].mean():.2f}%")
    print(f"Minimum borrow rate: {df['borrow_rate'].min():.2f}%")
    print(f"Maximum borrow rate: {df['borrow_rate'].max():.2f}%")
    print(f"Current borrow rate: {df['borrow_rate'].iloc[-1]:.2f}%")
    
    print("\nSupply Rate Statistics:")
    print(f"Average supply rate: {df['supply_rate'].mean():.2f}%")
    print(f"Minimum supply rate: {df['supply_rate'].min():.2f}%")
    print(f"Maximum supply rate: {df['supply_rate'].max():.2f}%")
    print(f"Current supply rate: {df['supply_rate'].iloc[-1]:.2f}%")
    
    print("\nUtilization Statistics:")
    print(f"Average utilization: {df['utilization'].mean():.2f}%")
    print(f"Minimum utilization: {df['utilization'].min():.2f}%")
    print(f"Maximum utilization: {df['utilization'].max():.2f}%")
    print(f"Current utilization: {df['utilization'].iloc[-1]:.2f}%")

def simulate_historical_data():
    """
    Create simulated data for testing when API access fails
    """
    print("Using simulated data for testing...")
    
    # Create a date range for the last 90 days
    end_date = datetime.now()
    start_date = end_date - timedelta(days=90)
    dates = pd.date_range(start=start_date, end=end_date, freq='D')
    
    # Create simulated rates with some random variation
    np.random.seed(42)  # For reproducibility
    
    # Base rates
    base_borrow_rate = 8.0
    base_supply_rate = 5.0
    base_utilization = 70.0
    
    # Add variations
    borrow_rates = base_borrow_rate + np.random.normal(0, 1, len(dates)) + np.sin(np.linspace(0, 6, len(dates))) * 2
    supply_rates = base_supply_rate + np.random.normal(0, 0.8, len(dates)) + np.sin(np.linspace(0, 6, len(dates))) * 1.5
    utilization = base_utilization + np.random.normal(0, 5, len(dates)) + np.sin(np.linspace(0, 6, len(dates))) * 8
    
    # Ensure values are within realistic ranges
    borrow_rates = np.clip(borrow_rates, 5, 15)
    supply_rates = np.clip(supply_rates, 2, 10)
    utilization = np.clip(utilization, 40, 95)
    
    # Create DataFrame
    df = pd.DataFrame({
        'timestamp': dates,
        'borrow_rate': borrow_rates,
        'supply_rate': supply_rates,
        'utilization': utilization
    })
    
    return df

def main():
    """
    Main function to orchestrate the data fetching and visualization
    """
    try:
        print("Fetching historical borrow rate data for cbBTC/USDC market...")
        
        try:
            # First try to get current market info
            market_info = fetch_market_rates()
            if market_info:
                print(f"Current borrow rate: {float(market_info.get('borrowRate', 0)) * 100:.2f}%")
                print(f"Current supply rate: {float(market_info.get('supplyRate', 0)) * 100:.2f}%")
            
            # Try to fetch historical data
            history_data = fetch_market_history(GRAPHQL_MARKET_ID, days=90)
            
            # Prepare data for plotting
            df = prepare_data_for_plotting(history_data)
            
        except Exception as api_error:
            print(f"API error: {api_error}")
            print("Using simulated data instead...")
            df = simulate_historical_data()
        
        # Print the number of data points
        print(f"Data points: {len(df)} from {df['timestamp'].min().date()} to {df['timestamp'].max().date()}")
        
        # Print summary statistics
        print_summary_statistics(df)
        
        # Create and show the plot
        plot_borrow_rate_history(df)
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main() 