import { execSync } from 'child_process';
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
        totalBorrowShares
        totalCollateral
      }
    }
  `;

  return await makeGraphQLRequest(query);
}

// Calculate utilization rate
function calculateUtilization(totalBorrow, totalSupply) {
  if (!totalBorrow || !totalSupply || BigInt(totalSupply) === 0n) {
    return 0;
  }
  
  return Number(BigInt(totalBorrow)) / Number(BigInt(totalSupply));
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

// Helper function to format BigInt values with decimals and commas
const formatBigIntUnits = (value, decimals) => {
    if (typeof value !== 'bigint') {
        // Attempt conversion if not already BigInt, default to 0n on failure
        try {
            value = BigInt(value || '0');
        } catch (e) {
            console.warn(`Could not convert value "${value}" to BigInt, using 0.`);
            value = 0n;
        }
    }
    if (value === 0n) return '0.00'; // Show 0 with decimals for consistency

    let str = value.toString();
    const isNegative = str.startsWith('-');
    if (isNegative) str = str.slice(1);

    const len = str.length;
    let intPart;
    let decPart;

    if (len <= decimals) {
        intPart = '0';
        decPart = '0'.repeat(decimals - len) + str;
    } else {
        intPart = str.slice(0, len - decimals);
        decPart = str.slice(len - decimals);
    }

    // Add commas to integer part
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    // Ensure decimal part exists for formatting
    decPart = decPart || '0';
    // Optionally trim trailing zeros from decimal part if desired, e.g., decPart.replace(/0+$/, '')
    // For currency, usually keep fixed decimals:
    decPart = decPart.padEnd(2, '0'); // Assuming we want at least 2 decimal places shown for currency

    return (isNegative ? '-' : '') + intPart + '.' + decPart;
};

// Main function to orchestrate all queries
async function main() {
  try {
    // Fetch the specific market by ID
    const marketData = await fetchMarketById(CBBTC_USDC_MARKET_ID);
    
    if (marketData.market) {
      const market = marketData.market;
      const loanDecimals = market.borrowedToken?.decimals ?? 6;
      const collateralDecimals = market.inputToken?.decimals ?? 8;
      const loanSymbol = market.borrowedToken?.symbol || 'USDC';
      const collateralSymbol = market.inputToken?.symbol || 'cbBTC';

      const totalSupplyRaw = BigInt(market.totalSupply || '0');
      const totalBorrowRaw = BigInt(market.totalBorrow || '0');
      const totalCollateralRaw = BigInt(market.totalCollateral || '0');

      const baseAvailableLiquidityRaw = totalSupplyRaw - totalBorrowRaw;

      let reallocatableLiquidityRaw = 0n;
      try {
          console.log('\nFetching reallocatable liquidity from Morpho Blue API...');
          const getMarketLiquidityScriptPath = path.resolve(__dirname, 'getMarketLiquidity.js');
          const scriptOutput = execSync(`node "${getMarketLiquidityScriptPath}"`, { encoding: 'utf-8' });
          const outputTrimmed = scriptOutput.trim();
          if (outputTrimmed && !isNaN(outputTrimmed)) {
             reallocatableLiquidityRaw = BigInt(outputTrimmed);
             console.log(`Reallocatable Liquidity (API Raw): ${reallocatableLiquidityRaw.toString()}`);
          } else {
             console.log(`Received invalid output from getMarketLiquidity.js: "${outputTrimmed}". Using 0.`);
             reallocatableLiquidityRaw = 0n;
          }
      } catch (execError) {
          console.error(`Error executing getMarketLiquidity.js: ${execError.stderr || execError.message}`);
          console.log('Could not fetch reallocatable liquidity, assuming 0 for calculation.');
          reallocatableLiquidityRaw = 0n;
      }

      const totalAvailableLiquidityRaw = baseAvailableLiquidityRaw + reallocatableLiquidityRaw;

      console.log('\ncbBTC/USDC Market Status:');
      console.log('------------------------------------------');
      console.log(`Market ID: ${market.id}`);
      console.log(`Total Supply (Subgraph): ${formatBigIntUnits(totalSupplyRaw, loanDecimals)} ${loanSymbol}`);
      console.log(`Total Borrow (Subgraph): ${formatBigIntUnits(totalBorrowRaw, loanDecimals)} ${loanSymbol}`);
      console.log(`Available Liquidity (Subgraph): ${formatBigIntUnits(baseAvailableLiquidityRaw, loanDecimals)} ${loanSymbol}`);
      console.log(`  ↳ (Total Supply - Total Borrow)`);
      console.log(`Reallocatable Liquidity (API): ${formatBigIntUnits(reallocatableLiquidityRaw, loanDecimals)} ${loanSymbol}`);
      console.log('------------------------------------------');
      console.log(`TOTAL AVAILABLE LIQUIDITY: ${formatBigIntUnits(totalAvailableLiquidityRaw, loanDecimals)} ${loanSymbol}`);
      console.log('  ↳ (Subgraph Available + API Reallocatable)');
      console.log('------------------------------------------');

      const utilization = calculateUtilization(market.totalBorrow, market.totalSupply);
      console.log(`Utilization Rate: ${(utilization * 100).toFixed(2)}%`);
      console.log(`Liquidation LTV: ${formatLLTV(market.lltv)}`);
      console.log(`Total Collateral: ${formatBigIntUnits(totalCollateralRaw, collateralDecimals)} ${collateralSymbol}`);

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