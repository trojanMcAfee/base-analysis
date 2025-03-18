# Morpho Market History Tracker

This script tracks the historical data of the cbBTC/USDC market on Morpho, retrieving key metrics such as supply, borrow, and utilization rate from the Morpho smart contract on the Base blockchain.

## Features

- Queries the Morpho contract for historical market data at regular intervals
- Visualizes supply, borrow, and available liquidity over time
- Tracks utilization rate across the market's lifecycle
- Generates high-quality plots in both PNG and SVG formats
- Exports data to CSV for further analysis
- Caches blockchain query results to avoid redundant API calls
- Automatic termination after generating plots and tables

## Installation

1. Clone this repository:
```
git clone <repository-url>
cd <repository-directory>
```

2. Install required packages:
```
pip install -r requirements.txt
```

3. Create a `.env` file with your Base RPC URL:
```
BASE_RPC_URL=https://your-base-rpc-url.com
```

## Usage

Run the script with:

```bash
python track_morpho_market_history.py
```

### Command Line Arguments

- `--force-refresh`: Force a refresh of the data from the blockchain (ignores cache)
- `--no-cache`: Disable caching entirely (will not read or write cache)
- `--show-plot`: Display the plot in a window (by default, plots are only saved to files)

### Caching System

To avoid repeatedly querying the blockchain API (which can be slow and subject to rate limits), the script includes a caching system:

- On first run, the script queries the blockchain and saves the results to `cache/morpho_market_data.pickle`
- On subsequent runs, it loads data from the cache file instead of querying the blockchain again
- The cache is validated to ensure it contains data for the correct block range
- To force a fresh query, use the `--force-refresh` flag

## Output Files

The script generates several output files:

- `morpho_market_history.csv`: CSV file containing all market data
- `morpho_market_history.png`: High-resolution PNG plot of market metrics
- `morpho_market_history.svg`: Vector SVG plot for high-quality presentations

## Example Output

The script produces a visualization showing:

- Total supply assets (blue line)
- Total borrowed assets (red line)
- Available liquidity (green line)
- Market utilization rate (purple line)

Additionally, it outputs a table showing these metrics at each queried block number. 