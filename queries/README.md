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