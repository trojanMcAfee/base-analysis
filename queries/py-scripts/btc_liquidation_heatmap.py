#!/usr/bin/env python3
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
import os
import subprocess

def load_position_data(file_path):
    """Load position data from the JSON file"""
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
        return data
    except Exception as e:
        print(f"Error loading data: {e}")
        return None

def get_current_btc_price():
    """Get current BTC price by calling btcPrice.js"""
    try:
        # Get the parent directory of the current script (queries directory)
        script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        # Run btcPrice.js and capture output
        result = subprocess.run(
            ['node', os.path.join(script_dir, 'btcPrice.js')], 
            capture_output=True, 
            text=True,
            check=True
        )
        
        # Parse the output to extract the price
        output_lines = result.stdout.strip().split('\n')
        for line in output_lines:
            if 'BTC/USD Price:' in line:
                # Extract the price value (remove $ and commas)
                price_str = line.split('$')[1].strip().replace(',', '')
                return float(price_str)
        
        # If price not found in the output
        print("Warning: Could not extract BTC price from btcPrice.js output")
        print("Output was:", result.stdout)
        return None
    
    except subprocess.CalledProcessError as e:
        print(f"Error running btcPrice.js: {e}")
        print(f"Error output: {e.stderr}")
        return None
    except Exception as e:
        print(f"Error getting BTC price: {e}")
        return None

def create_liquidation_price_dataframe(data):
    """Create a DataFrame with position data"""
    positions = []
    
    for pos in data['positions']:
        try:
            # The liquidation price is now included in the JSON data
            collateral_btc = pos['collateral']['cbBTC']
            borrowed_usd = pos['borrowed']['USD']
            liquidation_price = pos.get('liquidationPrice', None)
            
            if collateral_btc > 0 and liquidation_price is not None:
                positions.append({
                    'position_id': pos['position'],
                    'user_address': pos['userAddress'],
                    'collateral_btc': collateral_btc,
                    'collateral_usd': pos['collateral']['USD'],
                    'borrowed_usd': borrowed_usd,
                    'liquidation_price': liquidation_price,
                    'current_ltv': (borrowed_usd / pos['collateral']['USD']) * 100 if pos['collateral']['USD'] > 0 else 0
                })
        except Exception as e:
            print(f"Error processing position {pos.get('position', 'unknown')}: {e}")
    
    return pd.DataFrame(positions)

def filter_outliers(df, column, lower_quantile=0.01, upper_quantile=0.99):
    """Filter outliers from the dataframe based on quantiles"""
    lower_bound = df[column].quantile(lower_quantile)
    upper_bound = df[column].quantile(upper_quantile)
    return df[(df[column] >= lower_bound) & (df[column] <= upper_bound)]

def create_btc_liquidation_heatmap(df, current_btc_price=None):
    """Create a histogram of BTC liquidation prices"""
    # Filter outliers
    df_filtered = filter_outliers(df, 'liquidation_price')
    
    # Check if we have enough data
    if len(df_filtered) < 10:
        print("Not enough data points after filtering outliers")
        return
    
    # Create figure with proper size and background
    plt.figure(figsize=(12, 8))
    plt.style.use('dark_background')
    
    # Extract liquidation prices and weights (collateral amounts)
    prices = df_filtered['liquidation_price'].values
    weights = df_filtered['collateral_btc'].values
    
    # Define price range for histogram (extend to 100k to show current BTC price)
    min_price = max(df_filtered['liquidation_price'].min(), 35000)
    max_price = 100000  # Extended to 100k to show current BTC price
    
    # Create histogram bins
    bins = np.linspace(min_price, max_price, 30)
    
    # Create histogram with weights
    hist, bin_edges = np.histogram(prices, bins=bins, weights=weights)
    
    # Calculate bin centers for plotting
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
    
    # Create custom colormap (similar to image)
    colors = plt.cm.Blues(np.linspace(0.4, 1, 256))
    cmap = LinearSegmentedColormap.from_list('blue_gradient', colors)
    
    # Plot histogram
    plt.bar(bin_centers, hist, width=(bins[1]-bins[0]), alpha=0.7, color=colors[200])
    
    # Add vertical lines at key price points
    plt.axvline(x=50000, color='white', linestyle='--', alpha=0.8, linewidth=1.5)
    plt.axvline(x=100000, color='white', linestyle='--', alpha=0.8, linewidth=1.5)
    
    # Add some dotted vertical lines at intermediate points
    for price in np.linspace(40000, 90000, 6):
        plt.axvline(x=price, color='white', linestyle=':', alpha=0.4, linewidth=0.8)
    
    # Add current BTC price line if available
    if current_btc_price is not None:
        plt.axvline(x=current_btc_price, color='red', linestyle='-', alpha=1.0, linewidth=2.5)
        # Position the text based on where the price is
        if current_btc_price < max_price - 15000:
            plt.text(current_btc_price + 1000, hist.max() * 0.9, f"Current BTC Price: ${current_btc_price:,.0f}", 
                    color='red', fontsize=10, fontweight='bold')
        else:
            plt.text(current_btc_price - 15000, hist.max() * 0.9, f"Current BTC Price: ${current_btc_price:,.0f}", 
                    color='red', fontsize=10, fontweight='bold')
    
    # Add legend for vertical lines
    plt.text(51000, hist.max() * 0.97, "$50,000", color='white', fontsize=10)
    plt.text(90000, hist.max() * 0.97, "$100,000", color='white', fontsize=10)
    
    # Title and labels
    plt.title("Bitcoin Price Distribution", fontsize=24, pad=20)
    plt.xlabel("Bitcoin Price ($)", fontsize=16, labelpad=10)
    plt.ylabel("Number of Positions", fontsize=16, labelpad=10)
    
    # Adjust y-axis to start at 0
    plt.ylim(bottom=0)
    
    # Print some statistics
    print(f"Total positions analyzed: {len(df_filtered)}")
    print(f"Most concentrated liquidation price range: ${bin_centers[np.argmax(hist)]:,.0f}")
    
    # Add legend for lines
    legend_elements = [
        plt.Line2D([0], [0], color='white', linestyle='--', label='$50,000'),
        plt.Line2D([0], [0], color='white', linestyle='--', label='$100,000'),
    ]
    
    if current_btc_price is not None:
        legend_elements.append(
            plt.Line2D([0], [0], color='red', linestyle='-', label=f'Current BTC Price (${current_btc_price:,.0f})')
        )
    
    plt.legend(handles=legend_elements, loc='upper right', bbox_to_anchor=(0.99, 0.99), frameon=True)
    
    # Tight layout
    plt.tight_layout()
    
    # Save ONLY to plots/png directory (create if it doesn't exist)
    plot_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'plots', 'png')
    os.makedirs(plot_dir, exist_ok=True)
    plot_path = os.path.join(plot_dir, 'btc_liquidation_heatmap.png')
    plt.savefig(plot_path, dpi=300, bbox_inches='tight')
    print(f"Plot saved to: {plot_path}")
    
    # Show plot
    plt.show()

def additional_analysis(df):
    """Perform additional analysis on the liquidation prices"""
    # Print summary statistics
    print("\nLiquidation Price Statistics:")
    print(f"Average liquidation price: ${df['liquidation_price'].mean():,.2f}")
    print(f"Median liquidation price: ${df['liquidation_price'].median():,.2f}")
    print(f"Standard deviation: ${df['liquidation_price'].std():,.2f}")
    
    # Calculate concentration by price range
    price_ranges = [(35000, 40000), (40000, 45000), (45000, 50000), 
                    (50000, 55000), (55000, 60000), (60000, 65000),
                    (65000, 70000), (70000, 75000), (75000, 85000),
                    (85000, 100000)]
    
    print("\nPositions by Liquidation Price Range:")
    for lower, upper in price_ranges:
        count = len(df[(df['liquidation_price'] >= lower) & (df['liquidation_price'] < upper)])
        total_collateral = df[(df['liquidation_price'] >= lower) & (df['liquidation_price'] < upper)]['collateral_btc'].sum()
        pct = (count / len(df)) * 100
        print(f"${lower:,} - ${upper:,}: {count} positions ({pct:.1f}%) - Total collateral: {total_collateral:.4f} BTC")

def main():
    # Path to the JSON data file (adjusted for the new script location)
    queries_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_path = os.path.join(queries_dir, 'data', 'morpho_positions_all.json')
    
    # Load data
    data = load_position_data(data_path)
    if not data:
        return
    
    # Get current BTC price
    current_btc_price = get_current_btc_price()
    if current_btc_price:
        print(f"Current BTC Price: ${current_btc_price:,.2f}")
    
    # Process data
    df = create_liquidation_price_dataframe(data)
    
    # Print some basic stats
    print(f"Total positions loaded: {len(df)}")
    print(f"Positions with valid liquidation prices: {df['liquidation_price'].notna().sum()}")
    
    # Create heatmap
    create_btc_liquidation_heatmap(df, current_btc_price)
    
    # Perform additional analysis
    additional_analysis(df)

if __name__ == "__main__":
    main() 