#!/usr/bin/env python3
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib.colors import LinearSegmentedColormap
import os
from scipy.stats import gaussian_kde

# Constants
LLTV_DECIMAL = 0.86  # Based on the 86% LLTV found in the provided output

def load_position_data(file_path):
    """Load position data from the JSON file"""
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
        return data
    except Exception as e:
        print(f"Error loading data: {e}")
        return None

def calculate_liquidation_price(collateral, borrowed, lltv_decimal=LLTV_DECIMAL):
    """
    Calculate the liquidation price using the formula:
    Liquidation price = borrowed_assets / (collateral_units * lltv_decimal)
    """
    if collateral == 0:
        return None
    return borrowed / (collateral * lltv_decimal)

def create_liquidation_price_dataframe(data):
    """Create a DataFrame with position data and calculated liquidation prices"""
    positions = []
    
    for pos in data['positions']:
        try:
            collateral_btc = pos['collateral']['cbBTC']
            borrowed_usd = pos['borrowed']['USD']
            
            if collateral_btc > 0:
                liq_price = calculate_liquidation_price(collateral_btc, borrowed_usd)
                
                positions.append({
                    'position_id': pos['position'],
                    'user_address': pos['userAddress'],
                    'collateral_btc': collateral_btc,
                    'collateral_usd': pos['collateral']['USD'],
                    'borrowed_usd': borrowed_usd,
                    'liquidation_price': liq_price,
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

def create_btc_liquidation_heatmap(df):
    """Create a weighted heatmap of BTC liquidation prices"""
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
    
    # Define price range for histogram
    min_price = max(df_filtered['liquidation_price'].min(), 40000)
    max_price = min(df_filtered['liquidation_price'].max(), 110000)
    
    # Create histogram bins
    bins = np.linspace(min_price, max_price, 30)
    
    # Create histogram with weights
    hist, bin_edges = np.histogram(prices, bins=bins, weights=weights)
    
    # Calculate bin centers for plotting
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
    
    # Calculate KDE for smooth curve
    kde_weights = gaussian_kde(prices, weights=weights)
    x_range = np.linspace(min_price, max_price, 1000)
    kde_values = kde_weights(x_range)
    
    # Scale KDE to match histogram height
    kde_values = kde_values * (hist.max() / kde_values.max())
    
    # Create custom colormap (similar to image)
    colors = plt.cm.Blues(np.linspace(0.4, 1, 256))
    cmap = LinearSegmentedColormap.from_list('blue_gradient', colors)
    
    # Plot histogram
    plt.bar(bin_centers, hist, width=(bins[1]-bins[0]), alpha=0.7, color=colors[200])
    
    # Plot KDE curve
    plt.plot(x_range, kde_values, color='white', linewidth=2)
    
    # Add vertical lines at key price points (from the attached image)
    plt.axvline(x=50000, color='white', linestyle='--', alpha=0.8, linewidth=1.5)
    plt.axvline(x=100000, color='white', linestyle='--', alpha=0.8, linewidth=1.5)
    
    # Add some dotted vertical lines at intermediate points
    for price in np.linspace(60000, 90000, 4):
        plt.axvline(x=price, color='white', linestyle=':', alpha=0.5, linewidth=0.8)
    
    # Add legend for vertical lines
    plt.text(51000, hist.max() * 0.97, "$50,000", color='white', fontsize=10)
    plt.text(101000, hist.max() * 0.97, "$100,000", color='white', fontsize=10)
    
    # Title and labels
    plt.title("Bitcoin Price Distribution", fontsize=24, pad=20)
    plt.xlabel("Bitcoin Price ($)", fontsize=16, labelpad=10)
    plt.ylabel("Number of Positions", fontsize=16, labelpad=10)
    
    # Adjust y-axis to start at 0
    plt.ylim(bottom=0)
    
    # Print some statistics
    print(f"Total positions analyzed: {len(df_filtered)}")
    print(f"Most concentrated liquidation price range: ${bin_centers[np.argmax(hist)]:,.0f}")
    
    # Add legend on the right side
    legend_elements = [
        plt.Line2D([0], [0], color='white', linestyle='--', label='$50,000'),
        plt.Line2D([0], [0], color='white', linestyle='--', label='$100,000')
    ]
    plt.legend(handles=legend_elements, loc='upper right', bbox_to_anchor=(0.99, 0.99), frameon=True)
    
    # Tight layout and save
    plt.tight_layout()
    
    # Save to plots directory (create if it doesn't exist)
    plot_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'plots')
    os.makedirs(plot_dir, exist_ok=True)
    plot_path = os.path.join(plot_dir, 'btc_liquidation_heatmap.png')
    plt.savefig(plot_path, dpi=300, bbox_inches='tight')
    print(f"Plot saved to: {plot_path}")
    
    # Also save locally in the current directory for easy access
    current_dir_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'btc_liquidation_heatmap.png')
    plt.savefig(current_dir_path, dpi=300, bbox_inches='tight')
    print(f"Plot also saved to: {current_dir_path}")
    
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
    price_ranges = [(40000, 50000), (50000, 60000), (60000, 70000), 
                    (70000, 80000), (80000, 90000), (90000, 100000)]
    
    print("\nPositions by Liquidation Price Range:")
    for lower, upper in price_ranges:
        count = len(df[(df['liquidation_price'] >= lower) & (df['liquidation_price'] < upper)])
        total_collateral = df[(df['liquidation_price'] >= lower) & (df['liquidation_price'] < upper)]['collateral_btc'].sum()
        pct = (count / len(df)) * 100
        print(f"${lower:,} - ${upper:,}: {count} positions ({pct:.1f}%) - Total collateral: {total_collateral:.4f} BTC")

def main():
    # Path to the JSON data file
    data_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'morpho_positions_all.json')
    
    # Load data
    data = load_position_data(data_path)
    if not data:
        return
    
    # Process data
    df = create_liquidation_price_dataframe(data)
    
    # Print some basic stats
    print(f"Total positions loaded: {len(df)}")
    print(f"Positions with valid liquidation prices: {df['liquidation_price'].notna().sum()}")
    
    # Create heatmap
    create_btc_liquidation_heatmap(df)
    
    # Perform additional analysis
    additional_analysis(df)

if __name__ == "__main__":
    main() 