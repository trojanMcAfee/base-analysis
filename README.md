# Morpho Market Analysis for cbBTC/USDC

This project contains a suite of Python scripts for analyzing the historical data and future projections of the cbBTC/USDC market on Morpho's lending protocol on the Base blockchain.

## Directory Structure

- `analysis/`: Contains the Python scripts for data collection and analysis
- `plots/`: Contains the generated visualizations (PNG and SVG formats)
- `raw-data/`: Contains the exported CSV data
- `cache/`: Contains cached blockchain query results to improve performance

## Scripts

### 1. track_morpho_market_history.py

This script retrieves the historical market data for the cbBTC/USDC market on Morpho and generates multiple growth scenario projections for future market growth.

**Features:**
- Queries the Morpho contract for historical market data at regular intervals
- Calculates growth rates based on recent data (last 3 months)
- Projects future market metrics (supply, borrow, liquidity) for the next year using three scenarios:
  - **Bullish scenario**: 100% of the calculated growth rate
  - **Neutral scenario**: 50% of the calculated growth rate
  - **Bearish scenario**: 10% of the calculated growth rate
- Visualizes both historical and projected data in a single chart with clearly distinguishable line styles:
  - Supply lines use dashed patterns
  - Borrow lines use a distinctive dash-dot pattern
  - Liquidity lines use dotted patterns
  - Each scenario (Bullish, Neutral, Bearish) uses distinct colors (green, yellow, red)
- Displays detailed annotations with projected values
- Outputs monthly growth rate summaries for all scenarios
- Exports data to CSV (including projections)
- Caches blockchain query results for better performance

**Usage:**
```bash
cd analysis
python3 track_morpho_market_history.py [--force-refresh] [--no-cache] [--show-plot]
```

### 2. track_morpho_market_history_no_projections.py

Similar to the above script, but without the projections. This script only retrieves and visualizes historical data without any future projections.

**Features:**
- Queries the Morpho contract for historical market data at regular intervals
- Visualizes supply, borrow, available liquidity, and utilization rate over time
- Exports data to CSV (historical data only)
- Caches blockchain query results for better performance

**Usage:**
```bash
cd analysis
python3 track_morpho_market_history_no_projections.py [--force-refresh] [--no-cache] [--show-plot]
```

### 3. get_market_creation_block.py

A utility script to query the Morpho API for information about when the cbBTC/USDC market was created on Base.

**Features:**
- Queries the Morpho GraphQL API for market creation information
- Retrieves the creation block number, timestamp, and asset details
- Displays formatted information about the market

**Usage:**
```bash
cd analysis
python3 get_market_creation_block.py
```

### 4. query_morpho_market.py

A simple script to query the current state of the cbBTC/USDC market at a specific block number.

**Features:**
- Connects to the Base blockchain
- Queries the Morpho contract for market details at a specific block
- Displays supply, borrow, and other market metrics

**Usage:**
```bash
cd analysis
python3 query_morpho_market.py
```

## Command Line Arguments

The `track_morpho_market_history.py` and `track_morpho_market_history_no_projections.py` scripts accept these arguments:

- `--force-refresh`: Force refresh data from the blockchain instead of using cache
- `--no-cache`: Disable caching entirely (will not read or write cache)
- `--show-plot`: Display the plot window (by default, plots are only saved to files)

## Understanding the Charts

The main visualization produced by `track_morpho_market_history.py` shows:

1. **Historical Data** (solid lines):
   - Blue line: Historical Total Supply
   - Red line: Historical Total Borrow
   - Green line: Historical Available Liquidity (Supply minus Borrow)
   - Shaded area: Visualizes the market composition (red = borrowed, green = available liquidity)

2. **Projected Data** (after the vertical dashed line):
   - **Bullish Scenario** (Green): 100% of the calculated growth rate
   - **Neutral Scenario** (Yellow): 50% of the calculated growth rate
   - **Bearish Scenario** (Red): 10% of the calculated growth rate
   
   For each scenario:
   - Dashed lines represent Supply
   - Custom dash patterns represent Borrow
   - Dotted lines represent Available Liquidity
   
   Each line is annotated with its final projected value at the end of the one-year projection period.

3. **Growth Rate Summary**:
   The script also outputs a detailed summary of monthly growth rates for all three scenarios in the console.

## Output Files

The scripts generate several output files:

- `raw-data/morpho_market_history.csv`: CSV file containing all market data (including projections)
- `plots/png/morpho_market_history_multiple_scenarios.png`: Plot showing historical data with multiple growth scenarios (PNG format)
- `plots/svg/morpho_market_history_multiple_scenarios.svg`: Same plot in SVG vector format
- `plots/png/morpho_market_history_no_projections.png`: Plot showing only historical data (if using the no-projections script)

## Requirements

To run these scripts, you'll need:
- Python 3.9+
- Web3.py
- Pandas
- Matplotlib
- Seaborn
- NumPy
- Scipy (for the version with projections only)
- Requests (for the market creation script only)
- dotenv (for loading environment variables)

You'll also need to create a `.env` file with your Base RPC URL:
```
BASE_RPC_URL=https://your-base-rpc-url.com
```

## Getting Started

1. Clone this repository
2. Create a Python virtual environment: `python -m venv venv`
3. Activate the virtual environment: 
   - Linux/Mac: `source venv/bin/activate`
   - Windows: `venv\Scripts\activate`
4. Install dependencies: `pip install -r requirements.txt`
5. Create a `.env` file with your Base RPC URL
6. Run the analysis script: `python analysis/track_morpho_market_history.py`
7. Check the `plots` directory for the generated visualizations 