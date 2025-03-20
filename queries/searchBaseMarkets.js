const fetch = require('node-fetch');

// The GraphQL endpoint for Morpho's API
const endpoint = 'https://blue-api.morpho.org/graphql';

// Base chain ID
const BASE_CHAIN_ID = 8453;

// Function to make a direct GraphQL request
async function makeGraphQLRequest(query, variables = {}) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    const jsonResponse = await response.json();
    
    if (jsonResponse.errors) {
      console.error('GraphQL Errors:', jsonResponse.errors);
      throw new Error('GraphQL request failed');
    }
    
    return jsonResponse.data;
  } catch (error) {
    console.error('Error making request:', error);
    throw error;
  }
}

// Function to search for markets on Base chain
async function searchMarketsOnBase() {
  // Use the correct filter format based on schema exploration
  const marketsQuery = `
    {
      markets(
        first: 10,
        where: { chainId_in: [${BASE_CHAIN_ID}] }
      ) {
        items {
          id
          uniqueKey
          loanAsset {
            symbol
            address
          }
          collateralAsset {
            symbol
            address
          }
          state {
            supplyAssets
            borrowAssets
          }
        }
      }
    }
  `;
  
  try {
    console.log(`Searching for markets on Base chain (Chain ID: ${BASE_CHAIN_ID})...`);
    const data = await makeGraphQLRequest(marketsQuery);
    
    if (!data.markets || !data.markets.items || data.markets.items.length === 0) {
      console.log('No markets found on Base chain');
      return;
    }
    
    console.log(`\nFound ${data.markets.items.length} markets on Base chain:`);
    console.log('--------------------------------');
    
    data.markets.items.forEach((market, index) => {
      console.log(`\nMarket ${index + 1}:`);
      console.log(`ID: ${market.id}`);
      console.log(`Unique Key: ${market.uniqueKey}`);
      
      if (market.loanAsset) {
        console.log(`Loan Asset: ${market.loanAsset.symbol} (${market.loanAsset.address})`);
      }
      
      if (market.collateralAsset) {
        console.log(`Collateral Asset: ${market.collateralAsset.symbol} (${market.collateralAsset.address})`);
      }
      
      if (market.state) {
        console.log(`Supply Assets: ${market.state.supplyAssets}`);
        console.log(`Borrow Assets: ${market.state.borrowAssets}`);
      }
    });
    
    return data.markets.items;
  } catch (error) {
    console.error('Error searching markets:', error);
    throw error;
  }
}

// Execute the search
searchMarketsOnBase()
  .then(() => console.log('\nSearch completed successfully'))
  .catch(() => console.log('\nSearch failed')); 