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

// Try a simple query to get information about chains
async function fetchChains() {
  // Let's try a simpler query first just to get the schema structure
  const chainsQuery = `
    {
      chains {
        id
      }
    }
  `;
  
  try {
    console.log('Attempting to fetch basic chain information...');
    const chainsData = await makeGraphQLRequest(chainsQuery);
    console.log('Chains data:', JSON.stringify(chainsData, null, 2));
    
    return chainsData;
  } catch (error) {
    console.error('Error in fetchChains:', error);
    throw error;
  }
}

// Try to get market information
async function fetchMarket() {
  // Query for a specific market
  const marketQuery = `
    {
      market(id: "${MARKET_ID}") {
        id
        totalSupplyAssets
        totalBorrowAssets
      }
    }
  `;
  
  try {
    console.log(`\nAttempting to fetch market with ID: ${MARKET_ID}`);
    const marketData = await makeGraphQLRequest(marketQuery);
    console.log('Market data:', JSON.stringify(marketData, null, 2));
    
    return marketData;
  } catch (error) {
    console.error('Error in fetchMarket:', error);
  }
}

// Try to get all markets on Base chain
async function fetchMarketsOnBase() {
  // Try to fetch markets
  const marketsQuery = `
    {
      markets(first: 10, where: { chainId: ${BASE_CHAIN_ID} }) {
        items {
          id
          totalSupplyAssets
          totalBorrowAssets
        }
      }
    }
  `;
  
  try {
    console.log(`\nAttempting to fetch markets on Base chain (Chain ID: ${BASE_CHAIN_ID})...`);
    const marketsData = await makeGraphQLRequest(marketsQuery);
    console.log('Markets data:', JSON.stringify(marketsData, null, 2));
    
    return marketsData;
  } catch (error) {
    console.error('Error in fetchMarketsOnBase:', error);
  }
}

// Let's try to query by uniqueKey and chainId
async function fetchMarketByUniqueKey() {
  // Extract uniqueKey from the MARKET_ID (it might be the full ID or just a part)
  const uniqueKey = MARKET_ID;
  
  const marketQuery = `
    {
      marketByUniqueKey(uniqueKey: "${uniqueKey}", chainId: ${BASE_CHAIN_ID}) {
        id
        totalSupplyAssets
        totalBorrowAssets
      }
    }
  `;
  
  try {
    console.log(`\nAttempting to fetch market by uniqueKey: ${uniqueKey} and chainId: ${BASE_CHAIN_ID}`);
    const marketData = await makeGraphQLRequest(marketQuery);
    console.log('Market data by uniqueKey:', JSON.stringify(marketData, null, 2));
    
    return marketData;
  } catch (error) {
    console.error('Error in fetchMarketByUniqueKey:', error);
  }
}

// Execute all the query functions
async function runAllQueries() {
  try {
    await fetchChains();
    await fetchMarket();
    await fetchMarketsOnBase();
    await fetchMarketByUniqueKey();
    console.log('\nAll queries completed');
  } catch (error) {
    console.error('Error in runAllQueries:', error);
  }
}

// Run the queries
runAllQueries()
  .catch(error => console.log('\nFailed to run queries:', error.message)); 