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

// Function to fetch markets
async function fetchMarkets(skip = 0) {
  const query = `
    {
      markets(first: 20, skip: ${skip}) {
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
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Main function to orchestrate the query
async function main() {
  try {
    const skipCount = process.argv[2] ? parseInt(process.argv[2]) : 0;
    console.log(`Fetching markets from Base subgraph (skip: ${skipCount})...`);
    
    // Fetch markets
    const data = await fetchMarkets(skipCount);
    
    if (data.markets && data.markets.length > 0) {
      console.log(`Found ${data.markets.length} markets:`);
      
      // Check if our target market is in the results
      const targetMarketId = '0x84d3e4ee550dd5f99e76a548ac59a6be1c8dcf79'.toLowerCase();
      const targetMarket = data.markets.find(market => market.id.toLowerCase() === targetMarketId);
      
      if (targetMarket) {
        console.log('\n*** TARGET MARKET FOUND ***');
        console.log(`ID: ${targetMarket.id}`);
        console.log(`Name: ${targetMarket.name}`);
        
        if (targetMarket.inputToken) {
          console.log(`Token: ${targetMarket.inputToken.symbol} (${targetMarket.inputToken.name})`);
        }
        
        console.log(`TVL: $${parseFloat(targetMarket.totalValueLockedUSD).toLocaleString()}`);
        console.log(`Total Borrowed: $${parseFloat(targetMarket.totalBorrowBalanceUSD).toLocaleString()}`);
        
        if (targetMarket.rates && targetMarket.rates.length > 0) {
          console.log('Rates:');
          targetMarket.rates.forEach(rate => {
            const ratePercentage = parseFloat(rate.rate) * 100;
            console.log(`  - ${rate.side}/${rate.type}: ${ratePercentage.toFixed(2)}%`);
          });
        } else {
          console.log('No rates available');
        }
        console.log('*** END TARGET MARKET ***\n');
      }
      
      // Display all markets
      data.markets.forEach((market, index) => {
        console.log(`\nMarket #${skipCount + index + 1}:`);
        console.log(`ID: ${market.id}`);
        console.log(`Name: ${market.name}`);
        
        if (market.inputToken) {
          console.log(`Token: ${market.inputToken.symbol} (${market.inputToken.name})`);
        }
        
        console.log(`TVL: $${parseFloat(market.totalValueLockedUSD).toLocaleString()}`);
        console.log(`Total Borrowed: $${parseFloat(market.totalBorrowBalanceUSD).toLocaleString()}`);
        
        if (market.rates && market.rates.length > 0) {
          console.log('Rates:');
          market.rates.forEach(rate => {
            const ratePercentage = parseFloat(rate.rate) * 100;
            console.log(`  - ${rate.side}/${rate.type}: ${ratePercentage.toFixed(2)}%`);
          });
        } else {
          console.log('No rates available');
        }
      });
    } else {
      console.log('No markets found in this subgraph');
    }

  } catch (error) {
    console.error('Error in fetching data:', error);
    console.log('Query failed');
  }
}

// Execute the main function
main(); 