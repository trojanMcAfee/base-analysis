import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.private
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.private') });

// Constants
const API_KEY = process.env.THE_GRAPH_API_KEY;
const SUBGRAPH_ID = '71ZTy1veF9twER9CLMnPWeLQ7GZcwKsjmygejrgKirqs';
const SUBGRAPH_ENDPOINT = `https://gateway.thegraph.com/api/${API_KEY}/subgraphs/id/${SUBGRAPH_ID}`;
const MARKET_ID = '0x84d3e4ee550dd5f99e76a548ac59a6be1c8dcf79';

// Function to make a direct GraphQL request
async function makeGraphQLRequest(query, variables = {}) {
  try {
    const response = await fetch(SUBGRAPH_ENDPOINT, {
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
  // Based on the subgraph schema, we need to query the market and its rates
  const query = `
    {
      market(id: "${marketId}") {
        id
        rates {
          rate
          side
          type
        }
        totalValueLockedUSD
        totalBorrowBalanceUSD
        inputToken {
          symbol
          name
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
    const marketData = await fetchBorrowingRate(MARKET_ID);
    
    if (marketData.market && marketData.market.rates) {
      // Look for the borrow rate (side: BORROWER, type: VARIABLE)
      const borrowRate = marketData.market.rates.find(
        rate => rate.side === 'BORROWER' && rate.type === 'VARIABLE'
      );
      
      if (borrowRate) {
        // The rate is typically expressed as a decimal (e.g., 0.05 for 5%)
        // Multiply by 100 to get the percentage value
        const borrowRatePercentage = parseFloat(borrowRate.rate) * 100;
        
        // Output only the final borrowing rate as a percentage
        console.log(`${borrowRatePercentage.toFixed(2)}%`);
        
        // Optionally show more details about the market
        console.log('\nMarket Details:');
        console.log(`Token: ${marketData.market.inputToken.symbol} (${marketData.market.inputToken.name})`);
        console.log(`TVL: $${parseFloat(marketData.market.totalValueLockedUSD).toLocaleString()}`);
        console.log(`Total Borrowed: $${parseFloat(marketData.market.totalBorrowBalanceUSD).toLocaleString()}`);
      } else {
        console.log('No variable borrowing rate data found for this market');
      }
    } else {
      console.log('No market data found for the provided market ID');
    }

  } catch (error) {
    console.error('Error in fetching data:', error);
    console.log('Query failed');
  }
}

// Execute the main function
main(); 