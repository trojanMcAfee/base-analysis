import fetch from 'node-fetch';
import { MORPHO_GRAPHQL_ENDPOINT, GRAPHQL_MARKET_ID } from './state/common.js';

// Function to make a direct GraphQL request
async function makeGraphQLRequest(query, variables = {}) {
  try {
    const response = await fetch(MORPHO_GRAPHQL_ENDPOINT, {
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

// Function to fetch the count using __typename
async function fetchMarketPositionsCount(skip = 0, batchSize = 1000) {
  const query = `
    {
      marketPositions(
        first: ${batchSize}
        skip: ${skip}
        where: {
          borrowShares_gte: "1",
          chainId_in: [8453],
          marketId_in: ["${GRAPHQL_MARKET_ID}"]
        }
      ) {
        items {
          __typename
        }
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Main function to fetch and display the total count
async function main() {
  try {
    console.log(`Fetching total position count for cbBTC/USDC market (ID: ${GRAPHQL_MARKET_ID}) on Base...`);
    
    // Use pagination to count all positions
    let allPositionsCount = 0;
    let hasMore = true;
    let skip = 0;
    const batchSize = 1000; // Fetch in larger batches to minimize requests
    
    console.log(`Counting positions with borrowShares > 0...`);
    
    while (hasMore) {
      const data = await fetchMarketPositionsCount(skip, batchSize);
      
      if (data.marketPositions && data.marketPositions.items) {
        const batchCount = data.marketPositions.items.length;
        allPositionsCount += batchCount;
        
        // If we got less than the batch size, we've reached the end
        if (batchCount < batchSize) {
          hasMore = false;
        } else {
          skip += batchSize;
        }
      } else {
        hasMore = false;
      }
    }
    
    console.log(`\nTotal positions with open borrows: ${allPositionsCount}`);
    console.log(`Note: The main script only displays the first 100 positions in detail.`);

  } catch (error) {
    console.error('Error in fetching data:', error);
    console.log('Query failed');
  }
}

// Execute the main function
main(); 