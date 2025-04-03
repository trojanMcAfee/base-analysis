import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { BLOCK_NUMBER, CBBTC_USDC_MARKET_ID, SUBGRAPH_ID, getBaseSubgraphEndpoint } from './state/common.js';

// Load environment variables from .env.private
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.private') });


// Function to make a direct GraphQL request
async function makeGraphQLRequest(query, variables = {}) {
  try {
    const response = await fetch(getBaseSubgraphEndpoint(), {
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

// Function to fetch a market's borrowing rate by ID at a specific block
async function fetchBorrowingRate(marketId, blockNumber) {
  // Add block parameter if blockNumber is provided
  const blockParam = blockNumber ? `, block: { number: ${blockNumber} }` : '';
  
  const query = `
    {
      market(id: "${marketId}"${blockParam}) {
        id
        rates {
          rate
          side
          type
        }
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Main function to orchestrate the query
async function main() {
  try {
    // Using BLOCK_NUMBER from common.js
    console.log(`Fetching borrowing rate for cbBTC/USDC market at block ${BLOCK_NUMBER}...`);
    
    // Fetch the borrowing rate for the market
    const marketData = await fetchBorrowingRate(CBBTC_USDC_MARKET_ID, BLOCK_NUMBER);
    
    if (marketData.market && marketData.market.rates) {
      // Look for the borrow rate (side: BORROWER, type: VARIABLE)
      const borrowRate = marketData.market.rates.find(
        rate => rate.side === 'BORROWER' && rate.type === 'VARIABLE'
      );
      
      if (borrowRate) {
        // The rate is in decimal form (e.g., 0.05 for 5%)
        // Multiply by 100 to get the percentage value
        const borrowRatePercentage = parseFloat(borrowRate.rate) * 100;
        
        // Output only the final borrowing rate as a percentage
        console.log(`${borrowRatePercentage.toFixed(2)}%`);
      } else {
        console.log('No borrowing rate data found for the provided market ID');
      }
    } else {
      console.log('No market data found for the provided market ID');
      console.log('This could be because:');
      console.log('1. The market did not exist at the specified block');
      console.log('2. The subgraph has not indexed data for the specified block');
      console.log('3. The market ID is incorrect');
    }

  } catch (error) {
    console.error('Error in fetching data:', error);
    console.log('Query failed');
  }
}

// Execute the main function
main(); 