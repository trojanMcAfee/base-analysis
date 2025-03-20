# Morpho Market Data Queries

This directory contains scripts to fetch data from Morpho Blue markets on Base.

## supplyBorrowLiq.js

This script fetches market data for the cbBTC/USDC market on Base from Morpho's GraphQL API.

### Key Features
- Queries the most active cbBTC/USDC market on Base
- Displays total supply, total borrow, available liquidity, and utilization rate

### Usage

```bash
node supplyBorrowLiq.js
```

## utilizationTarget.js

This script queries the Morpho Blue smart contract directly to get the utilization target for the cbBTC/USDC market.

### Key Features
- Connects to the Morpho contract on Base using Web3.js
- Retrieves market configuration including interest rate model parameters
- Displays the utilization target, which is not available through the GraphQL API

### Usage

```bash
node utilizationTarget.js
```

### Configuration

The script is configured to fetch data for a specific cbBTC/USDC market on Base chain. If you want to query a different market, update the `marketId` variable in the script.

### Expected Output

The script will display:
- Market ID
- Market configuration (loan token, collateral token, oracle, etc.)
- LLTV (Loan-to-Value ratio)
- Utilization Target

## API Endpoints

- GraphQL API: `https://blue-api.morpho.org/graphql`
- Base Blockchain RPC: `https://mainnet.base.org`

## Dependencies

- node-fetch: For making HTTP requests to the GraphQL API
- web3: For interacting with the Morpho smart contract 