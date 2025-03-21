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

// Function to fetch a specific market by ID
async function fetchMarketById(marketId) {
  const query = `
    {
      market(id: "${marketId}") {
        id
        uniqueKey
        loanAsset {
          symbol
          address
          decimals
        }
        collateralAsset {
          symbol
          address
          decimals
        }
        lltv
        state {
          supplyAssets
          borrowAssets
          borrowShares
          liquidityAssets
          collateralAssets
          utilization
          timestamp
        }
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Function to format LLTV as percentage (divide by 1e18 and multiply by 100)
const formatLLTV = (value) => {
  if (!value) return 'N/A';
  try {
    // Convert from 18-decimal fixed point to percentage
    const numValue = (parseFloat(value) / 1e18) * 100;
    return numValue.toFixed(2) + '%';
  } catch (e) {
    return 'Error';
  }
};

// Function to get LLTV value as a number
async function getLLTV() {
  try {
    const marketData = await fetchMarketById(GRAPHQL_MARKET_ID);
    
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
    // Fetch the specific market by ID
    const marketData = await fetchMarketById(GRAPHQL_MARKET_ID);
    
    if (marketData.market && marketData.market.state) {
      const market = marketData.market;
      const formatValue = (value, decimals) => {
        if (!value) return 'N/A';
        if (value === '0') return '0';
        const numValue = parseFloat(value) / (10 ** (decimals || 0));
        return numValue.toLocaleString();
      };
      
      const loanDecimals = market.loanAsset?.decimals || 0;
      
      console.log('\ncbBTC/USDC Market Status:');
      console.log('------------------------');
      console.log(`Market ID: ${market.id}`);
      console.log(`Total Supply: ${formatValue(market.state.supplyAssets, loanDecimals)} USDC`);
      console.log(`Total Borrow: ${formatValue(market.state.borrowAssets, loanDecimals)} USDC`);
      console.log(`Available Liquidity: ${formatValue(market.state.liquidityAssets, loanDecimals)} USDC`);
      console.log(`Utilization Rate: ${market.state.utilization ? (parseFloat(market.state.utilization) * 100).toFixed(2) + '%' : 'N/A'}`);
      console.log(`Liquidation LTV: ${formatLLTV(market.lltv)}`);
      console.log(`Last Updated: ${market.state.timestamp ? new Date(parseInt(market.state.timestamp) * 1000).toISOString() : 'N/A'}`);
      console.log(`Total Borrow Shares: ${market.state.borrowShares}`);
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