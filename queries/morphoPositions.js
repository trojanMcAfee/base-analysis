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

// Function to fetch market schema information (for reference)
async function fetchMarketPositionSchema() {
  const query = `
    {
      __type(name: "MarketPosition") {
        name
        fields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Function to fetch market schema information (for reference)
async function fetchMarketSchema() {
  const query = `
    {
      __type(name: "Market") {
        name
        fields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Function to fetch positions for a specific market
async function fetchCbBtcUsdcPositions() {
  // The query using the correct fields and filtering for the cbBTC/USDC market
  const query = `
    {
      marketPositions(
        first: 100,
        where: {
          borrowShares_gte: "1",
          chainId_in: [8453],
          marketId_in: ["${GRAPHQL_MARKET_ID}"]
        }
      ) {
        items {
          id
          healthFactor
          user {
            address
          }
          market {
            id
            loanAsset {
              symbol
              decimals
            }
            collateralAsset {
              symbol
              decimals
            }
          }
          state {
            collateral
            collateralUsd
            borrowAssets
            borrowAssetsUsd
            borrowShares
            timestamp
          }
        }
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Main function to orchestrate the query
async function main() {
  try {
    console.log(`Fetching positions for cbBTC/USDC market (ID: ${GRAPHQL_MARKET_ID}) on Base...`);
    
    // Fetch positions for the cbBTC/USDC market
    const positionsData = await fetchCbBtcUsdcPositions();
    
    if (positionsData.marketPositions && positionsData.marketPositions.items && positionsData.marketPositions.items.length > 0) {
      const positions = positionsData.marketPositions.items;
      console.log(`\nFound ${positions.length} positions with open borrows in the cbBTC/USDC market:`);
      
      // Calculate total borrowed and collateral amounts
      let totalBorrowedUsd = 0;
      let totalCollateralUsd = 0;
      
      // Display the data in a structured format
      positions.forEach((position, index) => {
        const userAddress = position.user.address;
        const marketId = position.market.id;
        const marketName = `${position.market.collateralAsset.symbol}/${position.market.loanAsset.symbol}`;
        
        // Format values
        const state = position.state;
        const borrowDecimalFactor = 10 ** position.market.loanAsset.decimals;
        const collateralDecimalFactor = 10 ** position.market.collateralAsset.decimals;
        
        const collateralAmount = parseFloat(state.collateral) / collateralDecimalFactor;
        const borrowAmount = parseFloat(state.borrowAssets) / borrowDecimalFactor;
        const borrowUsd = parseFloat(state.borrowAssetsUsd);
        const collateralUsd = parseFloat(state.collateralUsd);
        
        // Add to totals
        totalBorrowedUsd += borrowUsd;
        totalCollateralUsd += collateralUsd;
        
        console.log(`\nPosition ${index + 1}:`);
        console.log(`  User: ${userAddress}`);
        console.log(`  Market: ${marketName}`);
        console.log(`  Collateral: ${collateralAmount.toFixed(8)} ${position.market.collateralAsset.symbol} ($${collateralUsd.toFixed(2)})`);
        console.log(`  Borrowed: ${borrowAmount.toFixed(6)} ${position.market.loanAsset.symbol} ($${borrowUsd.toFixed(2)})`);
        console.log(`  Health Factor: ${position.healthFactor !== null ? position.healthFactor.toFixed(4) : 'N/A'}`);
        
        // Calculate LTV
        if (collateralUsd && borrowUsd) {
          const ltv = (borrowUsd / collateralUsd) * 100;
          console.log(`  Loan-to-Value: ${ltv.toFixed(2)}%`);
        }
      });
      
      // Display market totals
      console.log('\n======= MARKET SUMMARY =======');
      console.log(`Total Positions: ${positions.length}`);
      console.log(`Total Borrowed: $${totalBorrowedUsd.toFixed(2)}`);
      console.log(`Total Collateral: $${totalCollateralUsd.toFixed(2)}`);
      console.log(`Average LTV: ${(totalBorrowedUsd / totalCollateralUsd * 100).toFixed(2)}%`);
      
    } else {
      console.log('No positions with open borrows found for the cbBTC/USDC market on Base.');
    }

  } catch (error) {
    console.error('Error in fetching data:', error);
    console.log('Query failed');
  }
}

// Execute the main function
main(); 