import fetch from 'node-fetch';
import { CBBTC_USDC_MARKET_ID, getBaseSubgraphEndpoint } from './state/common.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.private
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.private') });

// Function to make a GraphQL request to The Graph endpoint
async function makeGraphQLRequest(query, variables = {}) {
  try {
    // Ensure we have the API key
    const apiKey = process.env.THE_GRAPH_API_KEY;
    if (!apiKey) {
      throw new Error('THE_GRAPH_API_KEY is not defined in environment variables');
    }

    // Get the subgraph endpoint with the API key
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

// Function to fetch market data by ID
async function fetchMarketById(marketId) {
  const query = `
    {
      market(id: "${marketId}") {
        id
        lltv
        inputToken {
          symbol
          decimals
        }
        borrowedToken {
          symbol
          decimals
        }
        totalSupply
        totalBorrow
        liquidityAssets: inputTokenBalance
        totalCollateral
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Calculate utilization rate
function calculateUtilization(totalBorrow, totalSupply) {
  if (!totalBorrow || !totalSupply || totalSupply === '0') {
    return 0;
  }
  
  return parseFloat(totalBorrow) / parseFloat(totalSupply);
}

// Function to format LLTV as percentage
const formatLLTV = (value) => {
  if (!value) return 'N/A';
  try {
    // Convert from raw bigint value to percentage (assuming 18 decimals like in Morpho)
    const numValue = (parseFloat(value) / 1e18) * 100;
    return numValue.toFixed(2) + '%';
  } catch (e) {
    return 'Error';
  }
};

// Function to get LLTV value as a number
async function getLLTV() {
  try {
    const marketData = await fetchMarketById(CBBTC_USDC_MARKET_ID);
    
    if (marketData.market && marketData.market.lltv) {
      // Check if the value is a string and not empty
      if (typeof marketData.market.lltv === 'string' && marketData.market.lltv !== '') {
        const lltvValue = parseFloat(marketData.market.lltv) / 1e18 * 100;
        
        // If the calculation results in 0 or NaN, use default value
        if (isNaN(lltvValue) || lltvValue === 0) {
          console.log('Parsed LLTV is invalid, using default value of 85%');
          return 85;
        }
        
        return lltvValue;
      } else {
        console.log('LLTV value is not in expected format, using default value of 85%');
        return 85;
      }
    } else {
      console.log('\nFailed to retrieve LLTV value, using default value of 85%');
      return 85; // Use a default value instead of null
    }
  } catch (error) {
    console.error('\nError in fetching LLTV:', error);
    console.log('Using default LLTV value of 85%');
    return 85; // Use a default value instead of null
  }
}

// Main function to orchestrate all queries
async function main() {
  try {
    console.log('API Key:', process.env.THE_GRAPH_API_KEY ? 'Found' : 'Not found');
    
    // Fetch the specific market by ID
    const marketData = await fetchMarketById(CBBTC_USDC_MARKET_ID);
    
    if (marketData.market) {
      const market = marketData.market;
      const formatValue = (value, decimals) => {
        if (!value) return 'N/A';
        if (value === '0') return '0';
        const numValue = parseFloat(value) / (10 ** (decimals || 0));
        return numValue.toLocaleString();
      };
      
      const loanDecimals = market.borrowedToken?.decimals || 0;
      const utilization = calculateUtilization(market.totalBorrow, market.totalSupply);
      
      console.log('\ncbBTC/USDC Market Status from The Graph:');
      console.log('------------------------------------------');
      console.log(`Market ID: ${market.id}`);
      console.log(`Total Supply: ${formatValue(market.totalSupply, loanDecimals)} ${market.borrowedToken?.symbol || 'USDC'}`);
      console.log(`Total Borrow: ${formatValue(market.totalBorrow, loanDecimals)} ${market.borrowedToken?.symbol || 'USDC'}`);
      console.log(`Available Liquidity: ${formatValue(market.liquidityAssets, loanDecimals)} ${market.borrowedToken?.symbol || 'USDC'}`);
      console.log(`Utilization Rate: ${(utilization * 100).toFixed(2)}%`);
      console.log(`Liquidation LTV: ${formatLLTV(market.lltv)}`);
      console.log(`Total Collateral: ${formatValue(market.totalCollateral, market.inputToken?.decimals || 8)} ${market.inputToken?.symbol || 'cbBTC'}`);
    } else {
      console.log('\nNo market found with the provided ID');
    }

  } catch (error) {
    console.error('\nError in fetching data:', error);
    console.log('\nQuery failed');
  }
}

// Export functions to be used in other modules
export { fetchMarketById, main, formatLLTV, getLLTV };

// Execute the main function if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 