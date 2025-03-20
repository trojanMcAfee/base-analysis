const fetch = require('node-fetch');

// The GraphQL endpoint for Morpho's API
const endpoint = 'https://blue-api.morpho.org/graphql';

// Base chain ID
const BASE_CHAIN_ID = 8453;

// Known addresses for the assets we're interested in 
const CB_BTC_ADDRESS = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf'; // cbBTC on Base

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
          collateralAssetAddress_in: ["${CB_BTC_ADDRESS}"]
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
            borrowShares
            supplyShares
            liquidityAssets
            collateralAssets
            utilization
            timestamp
          }
        }
      }
    }
  `;
  
  console.log(`Searching for markets on Base with cbBTC as collateral...`);
  return await makeGraphQLRequest(query);
}

// Function to fetch transactions involving cbBTC
async function fetchCbBtcTransactions() {
  const query = `
    {
      transactions(
        first: 20,
        where: { 
          chainId_in: [${BASE_CHAIN_ID}]
        },
        orderBy: TIMESTAMP,
        orderDirection: DESC
      ) {
        items {
          id
          hash
          blockNumber
          timestamp
          from
          to
          value
          market {
            id
            uniqueKey
            loanAsset {
              symbol
            }
            collateralAsset {
              symbol
            }
          }
          type
        }
      }
    }
  `;
  
  console.log(`\nFetching recent transactions on Base...`);
  return await makeGraphQLRequest(query);
}

// Function to fetch asset data for cbBTC
async function fetchCbBtcAssetData() {
  const query = `
    {
      assetByAddress(address: "${CB_BTC_ADDRESS}", chainId: ${BASE_CHAIN_ID}) {
        id
        address
        name
        symbol
        decimals
        priceUsd
      }
    }
  `;
  
  console.log(`\nFetching cbBTC asset data on Base...`);
  return await makeGraphQLRequest(query);
}

// Main function to orchestrate all queries
async function main() {
  try {
    // Fetch markets with cbBTC as collateral
    const marketsData = await fetchCbBtcMarkets();
    if (marketsData.markets?.items?.length > 0) {
      console.log(`\nFound ${marketsData.markets.items.length} markets with cbBTC as collateral:`);
      marketsData.markets.items.forEach((market, index) => {
        console.log(`\nMarket ${index + 1}:`);
        console.log(`ID: ${market.id}`);
        console.log(`Unique Key: ${market.uniqueKey}`);
        console.log(`Loan Asset: ${market.loanAsset.symbol} (${market.loanAsset.address})`);
        console.log(`Collateral Asset: ${market.collateralAsset.symbol} (${market.collateralAsset.address})`);
        
        if (market.state) {
          const formatValue = (value, decimals) => {
            if (!value) return 'N/A';
            if (value === '0') return '0';
            const numValue = parseFloat(value) / (10 ** (decimals || 0));
            return numValue.toLocaleString();
          };
          
          const loanDecimals = market.loanAsset?.decimals || 0;
          const collateralDecimals = market.collateralAsset?.decimals || 0;
          
          console.log(`Supply Assets: ${formatValue(market.state.supplyAssets, loanDecimals)} ${market.loanAsset.symbol}`);
          console.log(`Borrow Assets: ${formatValue(market.state.borrowAssets, loanDecimals)} ${market.loanAsset.symbol}`);
          console.log(`Supply Shares: ${formatValue(market.state.supplyShares, loanDecimals)}`);
          console.log(`Borrow Shares: ${formatValue(market.state.borrowShares, loanDecimals)}`);
          console.log(`Liquidity Assets: ${formatValue(market.state.liquidityAssets, loanDecimals)} ${market.loanAsset.symbol}`);
          console.log(`Collateral Assets: ${formatValue(market.state.collateralAssets, collateralDecimals)} ${market.collateralAsset.symbol}`);
          console.log(`Utilization: ${market.state.utilization ? (parseFloat(market.state.utilization) * 100).toFixed(2) + '%' : 'N/A'}`);
          console.log(`Last Updated: ${market.state.timestamp ? new Date(parseInt(market.state.timestamp) * 1000).toISOString() : 'N/A'}`);
        } else {
          console.log('No state data available for this market');
        }
      });
    } else {
      console.log('No markets found with cbBTC as collateral');
    }

    // Fetch cbBTC asset data
    const assetData = await fetchCbBtcAssetData();
    if (assetData.assetByAddress) {
      const asset = assetData.assetByAddress;
      console.log(`\ncbBTC Asset Data:`);
      console.log(`ID: ${asset.id}`);
      console.log(`Name: ${asset.name}`);
      console.log(`Symbol: ${asset.symbol}`);
      console.log(`Decimals: ${asset.decimals}`);
      console.log(`Price (USD): $${parseFloat(asset.priceUsd).toLocaleString()}`);
    } else {
      console.log('\nNo data found for cbBTC asset');
    }

    // Fetch recent transactions
    const transactionsData = await fetchCbBtcTransactions();
    if (transactionsData.transactions?.items?.length > 0) {
      console.log(`\nFound ${transactionsData.transactions.items.length} recent transactions:`);
      transactionsData.transactions.items.forEach((tx, index) => {
        if (tx.market?.collateralAsset?.symbol === 'cbBTC' || tx.market?.loanAsset?.symbol === 'cbBTC') {
          console.log(`\nTransaction ${index + 1} (cbBTC related):`);
        } else {
          console.log(`\nTransaction ${index + 1}:`);
        }
        console.log(`Hash: ${tx.hash}`);
        console.log(`Type: ${tx.type}`);
        console.log(`Timestamp: ${new Date(parseInt(tx.timestamp) * 1000).toISOString()}`);
        console.log(`From: ${tx.from}`);
        console.log(`To: ${tx.to}`);
        if (tx.market) {
          console.log(`Market: ${tx.market.loanAsset.symbol}/${tx.market.collateralAsset.symbol}`);
        }
      });
    } else {
      console.log('\nNo transactions found');
    }

    console.log('\nQuery completed successfully');
  } catch (error) {
    console.error('\nError in fetching data:', error);
    console.log('\nQuery failed');
  }
}

// Execute the main function
main(); 