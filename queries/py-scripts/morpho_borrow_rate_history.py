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

def fetch_market_by_id(market_id):
    """
    Fetch current market data by ID
    """
    query = """
    query {
      market(id: "%s") {
        id
        uniqueKey
        state {
          supplyApy
          borrowApy
          utilization
          timestamp
        }
      }
    }
    """ % market_id
    
    return make_graphql_request(query)

def generate_current_snapshot(market_data):
    """
    Generate a snapshot of current market rates
    """
    if not market_data or 'market' not in market_data or 'state' not in market_data['market']:
        raise Exception("No market data available")
    
    # Get the current state
    state = market_data['market']['state']
    timestamp = datetime.fromtimestamp(int(state['timestamp']))
    supply_rate = float(state.get('supplyApy', 0)) * 100  # Convert to percentage
    borrow_rate = float(state.get('borrowApy', 0)) * 100  # Convert to percentage
    utilization = float(state.get('utilization', 0)) * 100  # Convert to percentage
    
    # Create a dataframe with a single row
    df = pd.DataFrame([{
        'timestamp': timestamp,
        'supply_rate': supply_rate,
        'borrow_rate': borrow_rate,
        'utilization': utilization
    }])
    
    return df

def plot_borrow_rate_history(df):
    """
    Create a plot of the historical borrow rate
    """
    plt.figure(figsize=(12, 8))
    plt.style.use('dark_background')
    
    # Get current values for the plot
    current_borrow_rate = df['borrow_rate'].iloc[-1]
    current_supply_rate = df['supply_rate'].iloc[-1]
    current_utilization = df['utilization'].iloc[-1]
    current_timestamp = df['timestamp'].iloc[-1]
    
    # Create a simple bar chart for the current rates
    rates = ['Borrow Rate', 'Supply Rate']
    values = [current_borrow_rate, current_supply_rate]
    colors = ['#3498db', '#2ecc71']
    
    # Plot the bars
    plt.bar(rates, values, color=colors)
    
    # Add value labels on top of bars
    for i, v in enumerate(values):
        plt.text(i, v + 0.5, f"{v:.2f}%", ha='center', fontweight='bold', color=colors[i])
    
    # Add utilization as text
    plt.figtext(0.5, 0.9, f"Current Utilization: {current_utilization:.2f}%", 
                ha='center', fontsize=14, color='#e74c3c', fontweight='bold')
    
    # Add timestamp information
    plt.figtext(0.5, 0.85, f"As of: {current_timestamp.strftime('%Y-%m-%d %H:%M:%S')}", 
                ha='center', fontsize=12, color='white')
    
    # Add labels and title
    plt.grid(True, alpha=0.3, axis='y')
    plt.ylabel('Rate (%)', fontsize=14)
    plt.title('Morpho cbBTC/USDC Market - Current Rates', fontsize=20, pad=20)
    
    # Set y-axis range
    max_rate = max(current_borrow_rate, current_supply_rate) * 1.2
    plt.ylim(0, max_rate)
    
    # Add a note about historical data
    plt.figtext(0.5, 0.02, 
                "Note: Historical rate data is not available through the API. Only current rates are shown.", 
                ha='center', fontsize=12, color='#f39c12')
    
    # Save to plots/png directory
    save_plot_to_file(plt, 'morpho_borrow_rate.png')
    
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

def print_current_rates(df):
    """
    Print current rate information
    """
    if df.empty:
        print("No data available")
        return
    
    print("\nCurrent Rate Information:")
    print(f"Timestamp: {df['timestamp'].iloc[-1]}")
    print(f"Borrow Rate: {df['borrow_rate'].iloc[-1]:.2f}%")
    print(f"Supply Rate: {df['supply_rate'].iloc[-1]:.2f}%")
    print(f"Utilization: {df['utilization'].iloc[-1]:.2f}%")

def main():
    """
    Main function to orchestrate the data fetching and visualization
    """
    try:
        print("Fetching current borrow rate data for cbBTC/USDC market...")
        
        # Get current market info
        market_data = fetch_market_by_id(GRAPHQL_MARKET_ID)
        
        if market_data and 'market' in market_data:
            print(f"Found market with ID: {market_data['market']['id']}")
            print(f"Market unique key: {market_data['market']['uniqueKey']}")
            
            # Generate a snapshot with current data
            df = generate_current_snapshot(market_data)
            
            # Print current rates
            print_current_rates(df)
            
            # Create and show the plot
            plot_borrow_rate_history(df)
            
            # Inform about historical data limitation
            print("\nNOTE: The Morpho API does not provide historical borrow rate data through the GraphQL endpoint.")
            print("To collect historical data, you would need to run this script regularly and save the results over time.")
        else:
            print("Failed to retrieve current market data")
            raise Exception("Could not get market data")
        
    except Exception as e:
        print(f"ERROR: Failed to fetch data from the Morpho API: {e}")
        raise  # Re-raise the exception to terminate execution

if __name__ == "__main__":
    main() 