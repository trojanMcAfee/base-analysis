# Morpho Market Data Queries

This directory contains scripts to fetch data from Morpho Blue markets on Base.

## supplyBorrowLiq.js

This script fetches market data for the cbBTC/USDC market on Base from Morpho's GraphQL API.

### Key Features
- Queries the most active cbBTC/USDC market on Base
- Displays total supply, total borrow, available liquidity, and utilization rate
- Shows the Liquidation LTV (LLTV) for the market, which is the maximum LTV ratio before liquidation occurs

### Usage

```bash
node supplyBorrowLiq.js
```

## userTransactions.js

This script fetches a user's transaction history and position data on Morpho's Base deployments.

### Key Features
- Retrieves user information using Morpho's GraphQL API with proper chain ID parameters
- Shows detailed information about user's active positions including:
  - Market details (collateral/loan assets)
  - Supply and borrow shares
  - Collateral amounts
  - Health factor
  - Last updated timestamp
- Lists the user's transaction history with:
  - Transaction hash
  - Transaction type (formatted for readability)
  - Block number
  - Timestamp

### Usage

```bash
node userTransactions.js [userAddress] [blockNumber]
```

If no parameters are provided, the script uses the default USER_ADDRESS and BLOCK_NUMBER from common.js.

## topSuppliers.js

This script identifies the top 3 vault suppliers of USDC in the cbBTC/USDC market on Base.

### Key Features
- Queries all suppliers in the cbBTC/USDC market on Base using Morpho's GraphQL API
- Fetches the total market supply to calculate percentage contributions
- Ranks suppliers by USDC amount supplied
- Displays the top 3 suppliers with their addresses, supplied amounts, and percentage of total market supply
- Shows when each supplier position was last updated

### Usage

```bash
node topSuppliers.js
```

## topSupplier.js

This script identifies the single largest supplier in the cbBTC/USDC market on Base by analyzing deposit and withdrawal history.

### Key Features
- Analyzes both deposit and withdrawal events to calculate net balances
- Fetches the total market supply to provide context for the top supplier's share
- Calculates the estimated net balance of each supplier after accounting for withdrawals
- Identifies the account with the highest net balance
- Shows the top supplier's address, balance, and percentage of total market supply
- Displays when the supplier's last activity occurred

### Usage

```bash
node topSupplier.js
```

## borrowRate.js

This script fetches the current borrowing rate for the cbBTC/USDC market from Morpho's GraphQL API.

### Key Features
- Queries the specified cbBTC/USDC market on Base
- Displays the current borrowing rate as a percentage
- Shows when the rate was last updated

### Usage

```bash
node borrowRate.js
```

## borrowRate24h.js

This script calculates the average borrowing rate for the cbBTC/USDC market over the previous 24 hours.

### Key Features
- Fetches the latest block number from the Base subgraph.
- Calculates approximate block numbers for each hour over the past 24 hours based on average block time.
- Queries the borrowing rate for the cbBTC/USDC market at each calculated hourly block using Morpho's GraphQL API.
- Averages the successfully fetched rates.
- Displays the calculated 24-hour average borrowing rate as a percentage.
- Logs the rate fetched for each hour (optional, controlled by commented-out log statements).

### Usage

```bash
node borrowRate24h.js
```

## calculateLTV.js

This script calculates the Loan-to-Value (LTV) ratio for a specific user's position in the cbBTC/USDC market.

### Key Features
- Connects to the Morpho contract on Base using Web3.js
- Fetches a user's position (borrow shares and collateral amount)
- Queries Chainlink oracle for BTC price
- Calculates LTV as `(borrowedAmount / (collateralAmount * oraclePrice)) * 100`
- Displays the LTV ratio as a percentage

### Usage

```bash
node calculateLTV.js
```

## calculateRequiredCollateral.js

This script calculates the required collateral amount for a given BORROWED_AMOUNT and target LTV.

### Key Features
- Connects to the Chainlink oracle on Base to fetch the BTC/USD price
- Calculates the required collateral value in USD using the formula: `REQUIRED_COLLATERAL_VALUE_USD = BORROWED_AMOUNT / (TARGET_LTV / 100)`
- Converts the required USD value to cbBTC using the formula: `REQUIRED_COLLATERAL_AMOUNT = REQUIRED_COLLATERAL_VALUE_USD / BTC_PRICE`
- Runs examples with different LTV scenarios (40% and 71.76%)
- Displays detailed calculation steps and formula explanations

### Usage

```bash
node calculateRequiredCollateral.js
```

## positionStatus.js

This script evaluates the risk status of a user's position based on its Loan-to-Value (LTV) ratio.

### Key Features
- Calls calculateLTV.js to get the current LTV of the position
- Fetches the maximum LTV (liquidation threshold) from the market data
- Categorizes the position status into risk levels based on LTV thresholds
- Displays a comprehensive risk assessment with color-coded status

### LTV Risk Scale
- 0% - 60%: Healthy (green) - Safe position with good collateralization
- 60% - 70%: Caution (yellow) - Position requires monitoring
- 70% - LLTV%: Warning (red) - Position at higher risk, close to liquidation threshold

### Usage

```bash
node positionStatus.js
```

## liqPrice.js

This script calculates the liquidation price for a specific user's position in the cbBTC/USDC market.

### Key Features
- Connects to the Morpho contract on Base using Web3.js
- Fetches a user's position (borrow shares and collateral amount)
- Retrieves the LLTV (Liquidation Loan-to-Value) from the market data
- Calculates liquidation price as `borrowedAmount / (collateralAmount * lltv)`
- Displays the price at which the user's position would be eligible for liquidation

### Usage

```bash
node liqPrice.js
```

## morphoPositions.js

This script fetches data on all positions in the cbBTC/USDC market and saves it to a JSON file.

### Key Features
- Queries all open positions from the cbBTC/USDC market using Morpho's GraphQL API
- Processes borrower data including collateral, borrowed amounts, and liquidation prices
- Calculates liquidation price for each position using the formula `borrowedAmount / (collateralAmount * lltv)`
- Creates a comprehensive dataset with position details and summary statistics
- Saves data to `data/morpho_positions_latest.json` for further analysis

### Usage

```bash
node morphoPositions.js
```

### Output File
The script generates `morpho_positions_latest.json` which contains:
- Summary statistics (total positions, total borrowed, total collateral, average LTV)
- Detailed data for each position including:
  - User address
  - Collateral amount (in BTC and USD)
  - Borrowed amount (in USDC and USD)
  - Calculated liquidation price

## py-scripts/btc_liquidation_heatmap.py

This Python script visualizes the distribution of liquidation prices across all positions. **Note:** This script uses data from `morpho_positions_latest.json`, which is generated by `morphoPositions.js` and may represent a snapshot from a specific point in time, not live data.

### Key Features
- Analyzes the `morpho_positions_latest.json` dataset
- Fetches current Bitcoin price from `btcPrice.js` for reference
- Creates a weighted histogram of liquidation prices, with larger positions having more visual impact
- Shows how liquidation prices are distributed relative to the current BTC price
- Provides additional statistical analysis of liquidation price ranges

### Usage

```bash
cd queries/py-scripts
python3 btc_liquidation_heatmap.py
```

### Output
- Generates a heatmap visualization saved to `plots/png/btc_liquidation_heatmap.png`
- Displays summary statistics about liquidation price distribution
- Shows the concentration of liquidation prices at different BTC price ranges

### Generated Files
The script creates `btc_liquidation_heatmap.png`, which is saved in the `plots/png` directory. This visualization shows the distribution of liquidation prices across all positions in the market, with the current BTC price indicated as a red vertical line for reference. It provides a clear visual representation of where liquidation risk is concentrated in the market.

## py-scripts/morpho_borrow_rate_history_90d.py

This Python script fetches and visualizes the Morpho borrowing rate history over the past 90 days at 7-day intervals.

### Key Features
- Queries the cbBTC/USDC market on Base at multiple historical blocks
- Calculates block numbers for each 7-day interval going back 90 days
- Fetches borrowing rates using Morpho's GraphQL API via The Graph
- Creates a time series visualization of borrowing rate changes
- Saves both raw data (CSV) and visualization (PNG) for analysis

### Usage

```bash
cd queries/py-scripts
python3 morpho_borrow_rate_history_90d.py
```

### Output
- Generates a line chart visualization saved to `plots/png/morpho_borrow_rate_history_90d.png`
- Saves the raw data to `plots/png/morpho_borrow_rate_history_90d.csv`
- Displays the trending borrowing rate over the specified time period
- Highlights the most recent borrowing rate with an annotation

### Dependencies
- pandas: For data manipulation
- matplotlib: For plotting the time series
- seaborn: For enhanced visualizations
- requests: For API calls to The Graph
- python-dotenv: For loading API keys from environment variables

## py-scripts/morpho_supply_borrow_history_3m.py

This Python script fetches and visualizes the Total Borrow and Available Liquidity for the cbBTC/USDC market over the past 3 months at weekly intervals.

### Key Features
- Queries the cbBTC/USDC market on Base at multiple historical blocks
- Calculates block numbers for each weekly interval going back 90 days
- Fetches Total Supply and Total Borrow using Morpho's GraphQL API via The Graph
- Calculates Available Liquidity (Total Supply - Total Borrow)
- Creates a dual-axis time series visualization of Total Borrow and Available Liquidity
- Scales Y-axis values to millions for readability
- Saves raw data (CSV) and visualization (PNG, SVG) for analysis

### Usage

```bash
cd queries/py-scripts
python3 morpho_supply_borrow_history_3m.py
```

### Output
- Generates a dual-axis line chart visualization saved to `plots/png/morpho_supply_borrow_history_3m.png` and `plots/svg/morpho_supply_borrow_history_3m.svg`
- Saves the raw data to `plots/png/morpho_supply_borrow_history_3m.csv`
- Displays the trending Total Borrow and Available Liquidity over the specified time period
- Highlights the most recent values with annotations

### Dependencies
- pandas: For data manipulation
- matplotlib: For plotting the time series
- seaborn: For enhanced visualizations
- numpy: For numerical operations
- requests: For API calls to The Graph
- python-dotenv: For loading API keys from environment variables

## btcPrice.js

This script fetches the current Bitcoin price from the Chainlink oracle on Base.

### Key Features
- Connects to the Chainlink BTC/USD price feed on Base
- Displays the current BTC price in USD
- Shows when the price was last updated

### Usage

```bash
node btcPrice.js
```

## btcBalanceUSD.js

This script calculates the USD value of a user's BTC holdings by combining on-chain data with oracle price feeds.

### Key Features
- Queries user's BTC balance from the blockchain
- Fetches current BTC/USD price from Chainlink oracle
- Calculates and displays the value of the holdings in USD

### Usage

```bash
node btcBalanceUSD.js
```

### Configuration

The scripts are configured to fetch data for specific cbBTC/USDC markets on Base chain. If you want to query different markets or users, update the relevant variables in each script:
- `MARKET_ID` or `marketId` for changing the target market
- `USER_ADDRESS` for changing the user position being analyzed
- `BLOCK_NUMBER` to query data at a specific blockchain height

### API Endpoints

- GraphQL API: `https://blue-api.morpho.org/graphql`
- Base Blockchain RPC: Configured via BASE_RPC_URL in .env file

## Dependencies

- web3: For interacting with the Morpho smart contracts and blockchain data
- node-fetch: For making HTTP requests to the GraphQL API
- dotenv: For loading environment variables
- Python dependencies (for btc_liquidation_heatmap.py):
  - pandas: For data manipulation
  - matplotlib: For visualization
  - numpy: For numerical operations