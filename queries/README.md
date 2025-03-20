# Morpho Market Data Queries

This directory contains scripts to fetch data from Morpho's GraphQL API.

## fetchMorphoMarketData.js

This script fetches the `supplyAssets` and `borrowAssets` for the cbBTC/USDC market on Base from Morpho's GraphQL API.

### Prerequisites

- Node.js installed
- NPM or Yarn installed

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

### Usage

Run the script:
```bash
node fetchMorphoMarketData.js
```

### Configuration

The script is configured to fetch data for the cbBTC/USDC market on the Base chain with the unique key: 
`0xf10437266b9dd52751bd6255e15cccd0cdf5c75b58c1a3e2621130c905cd8ed9`

If you want to query a different market, you can:
1. Run `node searchBaseMarkets.js` to list all available markets on Base chain
2. Run `node findCbBtcUsdcMarket.js` to specifically find cbBTC and USDC markets
3. Modify the `MARKET_UNIQUE_KEY` constant in the script

### API Endpoint

The script uses Morpho's GraphQL API at:
`https://blue-api.morpho.org/graphql`

## Expected Output

The script will display:
- Market ID
- Unique Key
- Loan Asset and its address
- Collateral Asset and its address
- Supply Assets (formatted with the correct token decimals)
- Borrow Assets (formatted with the correct token decimals)

## Additional Scripts

### searchBaseMarkets.js

This script searches for and lists all markets available on the Base chain. Use it to find valid market IDs and unique keys.

### findCbBtcUsdcMarket.js

This script specifically searches for markets involving cbBTC and USDC. It will display any markets that match this criteria.

### exploreMarketSchema.js

This script explores the schema of the Market and MarketFilters types to understand the available fields and their types.

### exploreMarketState.js

This script explores the schema of the MarketState type to understand its available fields and their types.

## Troubleshooting

If you encounter errors related to the API response, check:
1. That you're using a valid market unique key (use searchBaseMarkets.js or findCbBtcUsdcMarket.js to find valid keys)
2. That you're using the correct chain ID (Base is 8453)
3. The API endpoint is accessible
4. Your network connection is stable 