import fetch from 'node-fetch';
import { CBBTC_USDC_MARKET_ID, getBaseSubgraphEndpoint } from '../state/common.js'; // Adjusted path
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.private
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Adjusted path to .env.private relative to the new script location
dotenv.config({ path: path.resolve(__dirname, '../../.env.private') }); 

// Function to make a GraphQL request to The Graph endpoint
async function makeGraphQLRequest(query, variables = {}) {
  try {
    // Get the subgraph endpoint
    const endpoint = getBaseSubgraphEndpoint();

    // Only log the endpoint on the first request
    if (!makeGraphQLRequest.hasRun) {
      console.log(`Using endpoint: ${endpoint}`);
      makeGraphQLRequest.hasRun = true;
    }

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

// Initialize the flag
makeGraphQLRequest.hasRun = false;

// Function to fetch market data by ID with specific fields
async function fetchMarketDetails(marketId) {
  const query = `
    {
      market(id: "${marketId}") {
        id
        totalSupply
        totalSupplyShares
        totalBorrow
        totalBorrowShares
        lastUpdate 
        inputToken {
          symbol 
          decimals 
        }
        borrowedToken {
          symbol 
          decimals 
        }
      }
    }
  `;

  return await makeGraphQLRequest(query);
}

// Helper function to format BigInt values (optional, can be simplified if not needed)
const formatBigInt = (value) => {
    if (typeof value !== 'string' && typeof value !== 'bigint') {
        value = (value || 0).toString(); // Default to '0' if null/undefined
    }
    try {
        return BigInt(value).toString(); // Just return the string representation for now
    } catch (e) {
        console.warn(`Could not convert value "${value}" to BigInt.`);
        return 'Error';
    }
};

// Main function to orchestrate the query
async function main() {
  try {
    console.log(`Fetching details for market ID: ${CBBTC_USDC_MARKET_ID}`);
    // Fetch the specific market by ID
    const marketData = await fetchMarketDetails(CBBTC_USDC_MARKET_ID);

    if (marketData.market) {
      const market = marketData.market;
      const loanSymbol = market.borrowedToken?.symbol || 'N/A';
      // const collateralSymbol = market.inputToken?.symbol || 'N/A'; // Not strictly needed for output

      console.log('\nMarket Details (cbBTC/USDC):');
      console.log('------------------------------------------');
      console.log(`Market ID: ${market.id}`);
      console.log(`Total Supply: ${formatBigInt(market.totalSupply)} (raw) ${loanSymbol}`);
      console.log(`Total Supply Shares: ${formatBigInt(market.totalSupplyShares)} (raw)`);
      console.log(`Total Borrow: ${formatBigInt(market.totalBorrow)} (raw) ${loanSymbol}`);
      console.log(`Total Borrow Shares: ${formatBigInt(market.totalBorrowShares)} (raw)`);
      // Convert Unix timestamp (seconds) to Date
      const lastUpdateDate = new Date(parseInt(market.lastUpdate) * 1000); 
      console.log(`Last Update Timestamp: ${market.lastUpdate} (${lastUpdateDate.toUTCString()})`);
      console.log('------------------------------------------');

    } else {
      console.log(`
No market found with the ID: ${CBBTC_USDC_MARKET_ID}`);
    }

  } catch (error) {
    console.error('\nError fetching market details:', error);
    console.log('\nQuery failed');
  }
}

// Execute the main function if this file is run directly
if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

// Optional: Export functions if they need to be used elsewhere
export { fetchMarketDetails }; 