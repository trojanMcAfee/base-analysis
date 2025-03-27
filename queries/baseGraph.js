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
        name
        lltv
        inputToken {
          symbol
          id
          decimals
        }
        borrowedToken {
          symbol
          id
          decimals
        }
        totalSupply
        totalBorrow
        totalBorrowShares
        liquidityAssets: inputTokenBalance
        totalCollateral
        maximumLTV
        liquidationThreshold
        liquidationPenalty
        lastUpdate
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Function to fetch interest rates for a specific market
async function fetchInterestRates(marketId) {
  const query = `
    {
      lenderRates: interestRates(
        first: 1
        where: { 
          market: "${marketId}",
          side: LENDER
        }
        orderBy: rate
        orderDirection: desc
      ) {
        id
        rate
        side
      }
      borrowerRates: interestRates(
        first: 1
        where: { 
          market: "${marketId}",
          side: BORROWER
        }
        orderBy: rate
        orderDirection: desc
      ) {
        id
        rate
        side
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Calculate APY from interest rate
function calculateAPY(rate) {
  // Formula: APY = (e^rate - 1)
  if (!rate) return 0;
  
  const rateValue = parseFloat(rate);
  return (Math.exp(rateValue) - 1) * 100;
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

// Calculate utilization rate
function calculateUtilization(totalBorrow, totalSupply) {
  if (!totalBorrow || !totalSupply || totalSupply === '0') {
    return 0;
  }
  
  return parseFloat(totalBorrow) / parseFloat(totalSupply);
}

// Main function to orchestrate all queries
async function main() {
  try {
    console.log('API Key:', process.env.THE_GRAPH_API_KEY ? 'Found' : 'Not found');
    
    // Fetch the specific market by ID
    const marketData = await fetchMarketById(CBBTC_USDC_MARKET_ID);
    // Fetch interest rates for the market
    const ratesData = await fetchInterestRates(CBBTC_USDC_MARKET_ID);
    
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
      
      // Calculate APYs if rates data is available
      const supplyAPY = ratesData.lenderRates && ratesData.lenderRates.length > 0 
        ? calculateAPY(ratesData.lenderRates[0].rate) 
        : 'N/A';
      
      const borrowAPY = ratesData.borrowerRates && ratesData.borrowerRates.length > 0 
        ? calculateAPY(ratesData.borrowerRates[0].rate) 
        : 'N/A';
      
      console.log('\ncbBTC/USDC Market Status from The Graph:');
      console.log('------------------------------------------');
      console.log(`Market ID: ${market.id}`);
      console.log(`Market Name: ${market.name}`);
      console.log(`Total Supply: ${formatValue(market.totalSupply, loanDecimals)} ${market.borrowedToken?.symbol || 'USDC'}`);
      console.log(`Total Borrow: ${formatValue(market.totalBorrow, loanDecimals)} ${market.borrowedToken?.symbol || 'USDC'}`);
      console.log(`Available Liquidity: ${formatValue(market.liquidityAssets, loanDecimals)} ${market.borrowedToken?.symbol || 'USDC'}`);
      console.log(`Utilization Rate: ${(utilization * 100).toFixed(2)}%`);
      console.log(`Supply APY: ${typeof supplyAPY === 'number' ? supplyAPY.toFixed(2) + '%' : supplyAPY}`);
      console.log(`Borrow APY: ${typeof borrowAPY === 'number' ? borrowAPY.toFixed(2) + '%' : borrowAPY}`);
      console.log(`Liquidation LTV: ${formatLLTV(market.lltv)}`);
      console.log(`Maximum LTV: ${market.maximumLTV * 100}%`);
      console.log(`Liquidation Threshold: ${market.liquidationThreshold * 100}%`);
      console.log(`Liquidation Penalty: ${market.liquidationPenalty * 100}%`);
      console.log(`Last Updated: ${market.lastUpdate ? new Date(parseInt(market.lastUpdate) * 1000).toISOString() : 'N/A'}`);
      console.log(`Total Borrow Shares: ${market.totalBorrowShares}`);
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
export { fetchMarketById, fetchInterestRates, main, formatLLTV, getLLTV };

// Execute the main function if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 