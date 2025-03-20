const { request, gql } = require('graphql-request');
require('dotenv').config();

// The GraphQL endpoint for Morpho's API
const endpoint = 'https://blue-api.morpho.org/graphql';

// The target market's unique key on Base chain for cbBTC/USDC market
const MARKET_UNIQUE_KEY = '0xf10437266b9dd52751bd6255e15cccd0cdf5c75b58c1a3e2621130c905cd8ed9';

// Base chain ID
const BASE_CHAIN_ID = 8453;

// Define the GraphQL query using the marketByUniqueKey query
const query = gql`
  query GetMarketData {
    marketByUniqueKey(uniqueKey: "${MARKET_UNIQUE_KEY}", chainId: ${BASE_CHAIN_ID}) {
      id
      uniqueKey
      loanAsset {
        symbol
        decimals
        address
      }
      collateralAsset {
        symbol
        decimals
        address
      }
      state {
        supplyAssets
        borrowAssets
      }
    }
  }
`;

// Function to fetch the data
async function fetchMarketData() {
  try {
    console.log(`Fetching data for cbBTC/USDC market with unique key: ${MARKET_UNIQUE_KEY} on Base chain`);
    const data = await request(endpoint, query);
    
    console.log('\nMarket Data:');
    console.log('-----------');
    
    if (data.marketByUniqueKey) {
      const market = data.marketByUniqueKey;
      console.log(`Market ID: ${market.id}`);
      console.log(`Unique Key: ${market.uniqueKey}`);
      
      if (market.loanAsset) {
        console.log(`Loan Asset: ${market.loanAsset.symbol} (${market.loanAsset.address})`);
      }
      
      if (market.collateralAsset) {
        console.log(`Collateral Asset: ${market.collateralAsset.symbol} (${market.collateralAsset.address})`);
      }
      
      // Format the values with decimals if available
      const formatAssetValue = (value, decimals) => {
        if (!value) return 'N/A';
        if (!decimals) return value;
        
        // Convert to decimal representation based on token decimals
        const numValue = parseFloat(value) / (10 ** decimals);
        return numValue.toLocaleString();
      };
      
      if (market.state) {
        const loanDecimals = market.loanAsset?.decimals;
        console.log(`Supply Assets: ${formatAssetValue(market.state.supplyAssets, loanDecimals)} ${market.loanAsset?.symbol || ''}`);
        console.log(`Borrow Assets: ${formatAssetValue(market.state.borrowAssets, loanDecimals)} ${market.loanAsset?.symbol || ''}`);
      } else {
        console.log('No state data available for this market');
      }
    } else {
      console.log(`No data found for market with unique key: ${MARKET_UNIQUE_KEY}`);
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching market data:', error);
    if (error.response && error.response.errors) {
      console.error('GraphQL Errors:', error.response.errors);
    }
    throw error;
  }
}

// Execute the function
fetchMarketData()
  .then(() => console.log('\nQuery completed successfully'))
  .catch(() => console.log('\nQuery failed')); 