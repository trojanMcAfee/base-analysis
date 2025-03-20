const fetch = require('node-fetch');

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

// Function to search for markets involving cbBTC and USDC
async function searchCbBtcUsdcMarkets() {
  // Search for all markets on Base, we'll filter for cbBTC/USDC ourselves
  const marketsQuery = `
    {
      markets(
        first: 50,
        where: { chainId_in: [${BASE_CHAIN_ID}] }
      ) {
        items {
          id
          uniqueKey
          loanAsset {
            symbol
            address
          }
          collateralAsset {
            symbol
            address
          }
          state {
            supplyAssets
            borrowAssets
          }
        }
      }
    }
  `;
  
  try {
    console.log(`Searching for markets on Base chain (Chain ID: ${BASE_CHAIN_ID})...`);
    const data = await makeGraphQLRequest(marketsQuery);
    
    if (!data.markets || !data.markets.items || data.markets.items.length === 0) {
      console.log('No markets found on Base chain');
      return;
    }
    
    console.log(`\nFound ${data.markets.items.length} markets on Base chain, filtering for cbBTC/USDC markets...`);
    
    // Find markets where one asset is cbBTC and the other is USDC
    const cbBtcUsdcMarkets = data.markets.items.filter(market => {
      const loanAddress = market.loanAsset?.address?.toLowerCase();
      const collateralAddress = market.collateralAsset?.address?.toLowerCase();
      
      // Check for USDC as loan asset and cbBTC as collateral
      const isUsdcLoanCbBtcCollateral = 
        loanAddress === USDC_ADDRESS.toLowerCase() && 
        collateralAddress === CB_BTC_ADDRESS.toLowerCase();
      
      // Check for cbBTC as loan asset and USDC as collateral
      const isCbBtcLoanUsdcCollateral = 
        loanAddress === CB_BTC_ADDRESS.toLowerCase() && 
        collateralAddress === USDC_ADDRESS.toLowerCase();
      
      return isUsdcLoanCbBtcCollateral || isCbBtcLoanUsdcCollateral;
    });
    
    if (cbBtcUsdcMarkets.length === 0) {
      console.log('\nNo cbBTC/USDC markets found.');
      console.log('\nLooking for any markets involving cbBTC or USDC...');
      
      // If no direct matches, find any markets with either cbBTC or USDC
      const cbBtcMarkets = data.markets.items.filter(market => {
        const loanAddress = market.loanAsset?.address?.toLowerCase();
        const collateralAddress = market.collateralAsset?.address?.toLowerCase();
        return loanAddress === CB_BTC_ADDRESS.toLowerCase() || collateralAddress === CB_BTC_ADDRESS.toLowerCase();
      });
      
      const usdcMarkets = data.markets.items.filter(market => {
        const loanAddress = market.loanAsset?.address?.toLowerCase();
        const collateralAddress = market.collateralAsset?.address?.toLowerCase();
        return loanAddress === USDC_ADDRESS.toLowerCase() || collateralAddress === USDC_ADDRESS.toLowerCase();
      });
      
      console.log(`\nFound ${cbBtcMarkets.length} markets involving cbBTC:`);
      cbBtcMarkets.forEach((market, index) => {
        console.log(`\nCbBTC Market ${index + 1}:`);
        console.log(`ID: ${market.id}`);
        console.log(`Unique Key: ${market.uniqueKey}`);
        console.log(`Loan Asset: ${market.loanAsset.symbol} (${market.loanAsset.address})`);
        console.log(`Collateral Asset: ${market.collateralAsset.symbol} (${market.collateralAsset.address})`);
        console.log(`Supply Assets: ${market.state?.supplyAssets || 'N/A'}`);
        console.log(`Borrow Assets: ${market.state?.borrowAssets || 'N/A'}`);
      });
      
      console.log(`\nFound ${usdcMarkets.length} markets involving USDC:`);
      usdcMarkets.forEach((market, index) => {
        console.log(`\nUSDC Market ${index + 1}:`);
        console.log(`ID: ${market.id}`);
        console.log(`Unique Key: ${market.uniqueKey}`);
        console.log(`Loan Asset: ${market.loanAsset.symbol} (${market.loanAsset.address})`);
        console.log(`Collateral Asset: ${market.collateralAsset.symbol} (${market.collateralAsset.address})`);
        console.log(`Supply Assets: ${market.state?.supplyAssets || 'N/A'}`);
        console.log(`Borrow Assets: ${market.state?.borrowAssets || 'N/A'}`);
      });
      
      return { cbBtcMarkets, usdcMarkets };
    }
    
    console.log(`\nFound ${cbBtcUsdcMarkets.length} cbBTC/USDC markets:`);
    cbBtcUsdcMarkets.forEach((market, index) => {
      console.log(`\nMarket ${index + 1}:`);
      console.log(`ID: ${market.id}`);
      console.log(`Unique Key: ${market.uniqueKey}`);
      console.log(`Loan Asset: ${market.loanAsset.symbol} (${market.loanAsset.address})`);
      console.log(`Collateral Asset: ${market.collateralAsset.symbol} (${market.collateralAsset.address})`);
      console.log(`Supply Assets: ${market.state?.supplyAssets || 'N/A'}`);
      console.log(`Borrow Assets: ${market.state?.borrowAssets || 'N/A'}`);
    });
    
    return cbBtcUsdcMarkets;
  } catch (error) {
    console.error('Error searching markets:', error);
    throw error;
  }
}

// Execute the search
searchCbBtcUsdcMarkets()
  .then(() => console.log('\nSearch completed successfully'))
  .catch(() => console.log('\nSearch failed')); 