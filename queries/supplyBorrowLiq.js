import fetch from 'node-fetch';

// The GraphQL endpoint for Morpho's API
const endpoint = 'https://blue-api.morpho.org/graphql';

// Function to make a direct GraphQL request
async function makeGraphQLRequest(query, variables = {}) {
  try {
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

// Main function to orchestrate all queries
async function main() {
  try {
    // Market ID of the cbBTC/USDC market we're interested in
    const marketId = 'f6bdf547-ff28-429b-b81d-d98574a6fbcd';

    // Fetch the specific market by ID
    const marketData = await fetchMarketById(marketId);
    
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
export { fetchMarketById, main };

// Execute the main function if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}