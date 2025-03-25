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
const MARKET_ID = '0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836';

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

// Function to fetch the cbBTC/USDC market
async function fetchMarket(marketId) {
  // Query to get the market details including borrowing rates
  const query = `
    {
      market(id: "${marketId}") {
        id
        name
        inputToken {
          symbol
          name
        }
        rates {
          rate
          side
          type
        }
        totalValueLockedUSD
        totalBorrowBalanceUSD
        cumulativeBorrowUSD
        cumulativeSupplySideRevenueUSD
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Main function to orchestrate the query
async function main() {
  try {
    console.log(`Fetching cbBTC/USDC market data...`);
    
    // Fetch the market data
    const data = await fetchMarket(MARKET_ID);
    
    if (data.market) {
      console.log(`\nMarket Found!`);
      console.log(`ID: ${data.market.id}`);
      console.log(`Name: ${data.market.name}`);
      
      if (data.market.inputToken) {
        console.log(`Token: ${data.market.inputToken.symbol} (${data.market.inputToken.name})`);
      }
      
      console.log(`TVL: $${parseFloat(data.market.totalValueLockedUSD).toLocaleString()}`);
      console.log(`Total Borrowed: $${parseFloat(data.market.totalBorrowBalanceUSD).toLocaleString()}`);
      console.log(`Cumulative Borrow Volume: $${parseFloat(data.market.cumulativeBorrowUSD).toLocaleString()}`);
      console.log(`Cumulative Supply Revenue: $${parseFloat(data.market.cumulativeSupplySideRevenueUSD).toLocaleString()}`);
      
      if (data.market.rates && data.market.rates.length > 0) {
        console.log('\nRates:');
        
        // Find the borrowing rate (side: BORROWER, type: VARIABLE)
        const borrowRate = data.market.rates.find(
          rate => rate.side === 'BORROWER' && rate.type === 'VARIABLE'
        );
        
        if (borrowRate) {
          const borrowRatePercentage = parseFloat(borrowRate.rate) * 100;
          console.log(`Borrowing Rate: ${borrowRatePercentage.toFixed(2)}%`);
        } else {
          console.log('Borrowing rate not found');
        }
        
        // Also show all rates
        data.market.rates.forEach(rate => {
          const ratePercentage = parseFloat(rate.rate) * 100;
          console.log(`  - ${rate.side}/${rate.type}: ${ratePercentage.toFixed(2)}%`);
        });
      } else {
        console.log('No rates available');
      }
    } else {
      console.log('Market not found. The ID may be incorrect or the market does not exist in this subgraph.');
    }

  } catch (error) {
    console.error('Error in fetching data:', error);
    console.log('Query failed');
  }
}

// Execute the main function
main(); 