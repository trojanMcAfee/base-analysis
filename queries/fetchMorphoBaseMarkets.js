const { request, gql } = require('graphql-request');
require('dotenv').config();

// The GraphQL endpoint for Morpho's API
const endpoint = 'https://blue-api.morpho.org/graphql';

// Base chain ID is 8453
const BASE_CHAIN_ID = 8453;

// The address from the original market ID
const TARGET_ADDRESS = '0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836';

// Define the GraphQL query to fetch markets on Base chain
const marketsQuery = gql`
  query GetBaseMarkets {
    markets(
      first: 20, 
      where: { 
        chainId: ${BASE_CHAIN_ID}
      }
    ) {
      items {
        id
        address
        chainId
        totalSupplyAssets
        totalBorrowAssets
        loanToken {
          symbol
          decimals
          address
        }
        collateralToken {
          symbol
          decimals
          address
        }
      }
    }
  }
`;

// Function to find a specific market by address (if needed)
const findMarketByAddress = (markets, targetAddress) => {
  // Try to find an exact match first
  const exactMatch = markets.find(market => 
    market.address.toLowerCase() === targetAddress.toLowerCase());
  
  if (exactMatch) return exactMatch;
  
  // If no exact match, check if the address is a substring 
  // (in case it's part of a composite ID)
  return markets.find(market => 
    market.id.toLowerCase().includes(targetAddress.toLowerCase()));
};

// Function to format asset values with proper decimals
const formatAssetValue = (value, decimals) => {
  if (!value) return 'N/A';
  if (!decimals) return value;
  
  // Convert to decimal representation based on token decimals
  const numValue = parseFloat(value) / (10 ** decimals);
  return numValue.toLocaleString();
};

// Function to fetch the data
async function fetchBaseMarkets() {
  try {
    console.log(`Fetching markets on Base chain (Chain ID: ${BASE_CHAIN_ID})`);
    const data = await request(endpoint, marketsQuery);
    
    if (!data.markets || !data.markets.items || data.markets.items.length === 0) {
      console.log('No markets found on Base chain');
      return;
    }
    
    console.log(`\nFound ${data.markets.items.length} markets on Base chain`);
    
    // Try to find our target market if an address was provided
    const targetMarket = TARGET_ADDRESS 
      ? findMarketByAddress(data.markets.items, TARGET_ADDRESS) 
      : null;
    
    if (targetMarket) {
      console.log('\nTarget Market Details:');
      console.log('---------------------');
      console.log(`Market ID: ${targetMarket.id}`);
      console.log(`Market Address: ${targetMarket.address}`);
      
      if (targetMarket.loanToken) {
        console.log(`Loan Token: ${targetMarket.loanToken.symbol} (${targetMarket.loanToken.address})`);
      }
      
      if (targetMarket.collateralToken) {
        console.log(`Collateral Token: ${targetMarket.collateralToken.symbol} (${targetMarket.collateralToken.address})`);
      }
      
      const loanDecimals = targetMarket.loanToken?.decimals;
      console.log(`Total Supply Assets: ${formatAssetValue(targetMarket.totalSupplyAssets, loanDecimals)} ${targetMarket.loanToken?.symbol || ''}`);
      console.log(`Total Borrow Assets: ${formatAssetValue(targetMarket.totalBorrowAssets, loanDecimals)} ${targetMarket.loanToken?.symbol || ''}`);
    }
    
    // List all markets
    console.log('\nAll Base Markets:');
    console.log('----------------');
    
    data.markets.items.forEach((market, index) => {
      const loanSymbol = market.loanToken?.symbol || 'Unknown';
      const collateralSymbol = market.collateralToken?.symbol || 'Unknown';
      const loanDecimals = market.loanToken?.decimals;
      
      console.log(`\nMarket ${index + 1}:`);
      console.log(`ID: ${market.id}`);
      console.log(`Pair: ${loanSymbol}/${collateralSymbol}`);
      console.log(`Total Supply: ${formatAssetValue(market.totalSupplyAssets, loanDecimals)} ${loanSymbol}`);
      console.log(`Total Borrow: ${formatAssetValue(market.totalBorrowAssets, loanDecimals)} ${loanSymbol}`);
    });
    
    return data.markets.items;
  } catch (error) {
    console.error('Error fetching market data:', error);
    if (error.response && error.response.errors) {
      console.error('GraphQL Errors:', error.response.errors);
    }
    throw error;
  }
}

// Execute the function
fetchBaseMarkets()
  .then(() => console.log('\nQuery completed successfully'))
  .catch(() => console.log('\nQuery failed')); 