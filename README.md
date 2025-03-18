# Morpho Market Analysis for cbBTC/USDC

This project contains a suite of Python scripts for analyzing the historical data and future projections of the cbBTC/USDC market on Morpho's lending protocol on the Base blockchain.

## Directory Structure

- `analysis/`: Contains the Python scripts for data collection and analysis
- `plots/`: Contains the generated visualizations
- `raw-data/`: Contains the exported CSV data
- `cache/`: Contains cached blockchain query results to improve performance

## Scripts

### 1. track_morpho_market_history.py

This script retrieves the historical market data for the cbBTC/USDC market on Morpho and generates projections for future market growth. It creates a visualization with both historical data and future projections.

**Features:**
- Queries the Morpho contract for historical market data at regular intervals
- Calculates growth rates based on recent data (last 3 months)
- Projects future market metrics (supply, borrow, liquidity) for the next year
- Visualizes both historical and projected data in a single chart
- Displays projection annotations at the end of each trend line
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

## Output Files

The scripts generate several output files:

- `raw-data/morpho_market_history.csv`: CSV file containing all market data (including projections if available)
- `plots/morpho_market_history_with_projections.png/svg`: Plot showing historical data with projections
- `plots/morpho_market_history_no_projections.png/svg`: Plot showing only historical data

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