const fetch = require('node-fetch');

// The GraphQL endpoint for Morpho's API
const endpoint = 'https://blue-api.morpho.org/graphql';

// The market ID we're interested in
const MARKET_ID = '0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836';

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

// Try a simple query to get information about markets on Base
async function fetchMarkets() {
  // Let's first try to get all chains to ensure we have the right chainId
  const chainsQuery = `
    {
      chains {
        id
        name
      }
    }
  `;
  
  // Then we'll try to get markets with that chainId
  const marketsQuery = `
    {
      markets(first: 10, where: { chainId: ${BASE_CHAIN_ID} }) {
        items {
          id
          address
          chainId
          totalSupplyAssets
          totalBorrowAssets
          loanToken {
            symbol
            decimals
          }
          collateralToken {
            symbol
            decimals
          }
        }
      }
    }
  `;
  
  try {
    console.log('Attempting to fetch chain information...');
    const chainsData = await makeGraphQLRequest(chainsQuery);
    console.log('Chains data:', JSON.stringify(chainsData, null, 2));
    
    console.log('\nAttempting to fetch markets on Base chain...');
    const marketsData = await makeGraphQLRequest(marketsQuery);
    console.log('Markets data:', JSON.stringify(marketsData, null, 2));
    
    // If we have markets data, look for our target market
    if (marketsData && marketsData.markets && marketsData.markets.items) {
      const marketsList = marketsData.markets.items;
      console.log(`\nFound ${marketsList.length} markets on Base chain`);
      
      // Try to find our target market
      const targetMarket = marketsList.find(market => 
        market.id.includes(MARKET_ID) || 
        (market.address && market.address.toLowerCase() === MARKET_ID.toLowerCase())
      );
      
      if (targetMarket) {
        console.log('\nTarget Market Found:');
        console.log('-------------------');
        console.log(`Market ID: ${targetMarket.id}`);
        console.log(`Total Supply Assets: ${targetMarket.totalSupplyAssets}`);
        console.log(`Total Borrow Assets: ${targetMarket.totalBorrowAssets}`);
      } else {
        console.log(`\nTarget market with ID ${MARKET_ID} not found.`);
      }
    }
    
    return chainsData;
  } catch (error) {
    console.error('Error in fetchMarkets:', error);
  }
}

// Execute the function
fetchMarkets()
  .then(() => console.log('\nQuery completed'))
  .catch(error => console.log('\nQuery failed:', error.message)); 