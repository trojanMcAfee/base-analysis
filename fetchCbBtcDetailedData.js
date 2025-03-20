import fetch from 'node-fetch';

// The GraphQL endpoint for Morpho's API
const endpoint = 'https://blue-api.morpho.org/graphql';

// Base chain ID
const BASE_CHAIN_ID = 8453;

// Known addresses for the assets we're interested in 
const CB_BTC_ADDRESS = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf'; // cbBTC on Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC on Base

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

// Function to search for all markets involving cbBTC on Base
async function fetchCbBtcMarkets() {
  const query = `
    {
      markets(
        first: 100,
        where: { 
          chainId_in: [${BASE_CHAIN_ID}],
          collateralAssetAddress_in: ["${CB_BTC_ADDRESS}"],
          loanAssetAddress_in: ["${USDC_ADDRESS}"]
        }
      ) {
        items {
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
            liquidityAssets
            collateralAssets
            utilization
            timestamp
          }
        }
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Main function to orchestrate all queries
async function main() {
  try {
    // Fetch markets with cbBTC as collateral and USDC as loan asset
    const marketsData = await fetchCbBtcMarkets();
    
    // Find the most active market (highest total supply)
    const activeMarket = marketsData.markets?.items?.reduce((mostActive, current) => {
      const currentSupply = current.state?.supplyAssets ? BigInt(current.state.supplyAssets) : BigInt(0);
      const maxSupply = mostActive?.state?.supplyAssets ? BigInt(mostActive.state.supplyAssets) : BigInt(0);
      return currentSupply > maxSupply ? current : mostActive;
    }, null);

    if (activeMarket && activeMarket.state) {
      const formatValue = (value, decimals) => {
        if (!value) return 'N/A';
        if (value === '0') return '0';
        const numValue = parseFloat(value) / (10 ** (decimals || 0));
        return numValue.toLocaleString();
      };
      
      const loanDecimals = activeMarket.loanAsset?.decimals || 0;
      
      console.log('\ncbBTC/USDC Market Status:');
      console.log('------------------------');
      console.log(`Market ID: ${activeMarket.id}`);
      console.log(`Total Supply: ${formatValue(activeMarket.state.supplyAssets, loanDecimals)} USDC`);
      console.log(`Total Borrow: ${formatValue(activeMarket.state.borrowAssets, loanDecimals)} USDC`);
      console.log(`Available Liquidity: ${formatValue(activeMarket.state.liquidityAssets, loanDecimals)} USDC`);
      console.log(`Utilization Rate: ${activeMarket.state.utilization ? (parseFloat(activeMarket.state.utilization) * 100).toFixed(2) + '%' : 'N/A'}`);
      console.log(`Last Updated: ${activeMarket.state.timestamp ? new Date(parseInt(activeMarket.state.timestamp) * 1000).toISOString() : 'N/A'}`);
    } else {
      console.log('\nNo active cbBTC/USDC markets found');
    }

  } catch (error) {
    console.error('\nError in fetching data:', error);
    console.log('\nQuery failed');
  }
}

// Execute the main function
main();