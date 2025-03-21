import fetch from 'node-fetch';
import { MORPHO_GRAPHQL_ENDPOINT, GRAPHQL_MARKET_ID } from './state/variables.js';

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

// Function to fetch a market's borrowing rate by ID
async function fetchBorrowingRate(marketId) {
  const query = `
    {
      market(id: "${marketId}") {
        id
        state {
          borrowApy
          timestamp
        }
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Main function to orchestrate the query
async function main() {
  try {
    // Fetch the borrowing rate for the market
    const marketData = await fetchBorrowingRate(GRAPHQL_MARKET_ID);
    
    if (marketData.market && marketData.market.state) {
      const state = marketData.market.state;
      
      // The borrowApy is in decimal form (e.g., 0.05 for 5%)
      // Multiply by 100 to get the percentage value
      const borrowApyPercentage = state.borrowApy * 100;
      
      // Output only the final borrowing rate as a percentage
      console.log(`${borrowApyPercentage.toFixed(2)}%`);
    } else {
      console.log('No borrowing rate data found for the provided market ID');
    }

  } catch (error) {
    console.error('Error in fetching data:', error);
    console.log('Query failed');
  }
}

// Execute the main function
main(); 