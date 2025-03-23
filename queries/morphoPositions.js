import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
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

// Function to fetch positions for a specific market with pagination
async function fetchCbBtcUsdcPositions(skip, batchSize) {
  // The query using the correct fields and filtering for the cbBTC/USDC market
  const query = `
    {
      marketPositions(
        first: ${batchSize}
        skip: ${skip}
        where: {
          borrowShares_gte: "1",
          chainId_in: [8453],
          marketId_in: ["${GRAPHQL_MARKET_ID}"]
        }
      ) {
        items {
          id
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
    console.log(`Fetching all positions for cbBTC/USDC market (ID: ${GRAPHQL_MARKET_ID}) on Base...`);
    
    // Parameters for pagination
    const batchSize = 100;
    let skip = 0;
    let hasMore = true;
    let allPositions = [];
    let positionCount = 0;
    
    // Create data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    console.log('Starting to fetch all positions in batches...');

    // Fetch all positions using pagination
    while (hasMore) {
      console.log(`Fetching batch: positions ${skip} to ${skip + batchSize - 1}...`);
      
      const positionsData = await fetchCbBtcUsdcPositions(skip, batchSize);
      
      if (positionsData.marketPositions && positionsData.marketPositions.items) {
        const positions = positionsData.marketPositions.items;
        
        if (positions.length === 0) {
          hasMore = false;
          console.log('No more positions to fetch.');
          break;
        }
        
        // Process each position in this batch
        const formattedPositions = positions.map(position => {
          positionCount++;
          
          const userAddress = position.user.address;
          
          // Format values
          const state = position.state;
          const borrowDecimalFactor = 10 ** position.market.loanAsset.decimals;
          const collateralDecimalFactor = 10 ** position.market.collateralAsset.decimals;
          
          // Parse values with validation
          const collateralAmount = state.collateral ? parseFloat(state.collateral) / collateralDecimalFactor : 0;
          const borrowAmount = state.borrowAssets ? parseFloat(state.borrowAssets) / borrowDecimalFactor : 0;
          
          // For USDC, the asset value is equal to the USD value (1:1)
          // Use borrowAssets directly as USD value since borrowAssetsUsd is null
          const borrowUsd = state.borrowAssets ? parseFloat(state.borrowAssets) / borrowDecimalFactor : 0;
          const collateralUsd = state.collateralUsd ? parseFloat(state.collateralUsd) : 0;
          
          return {
            position: positionCount,
            userAddress: userAddress,
            collateral: {
              cbBTC: collateralAmount,
              USD: collateralUsd
            },
            borrowed: {
              USDC: borrowAmount,
              USD: borrowUsd
            }
          };
        });
        
        // Add the processed positions to our collection
        allPositions = [...allPositions, ...formattedPositions];
        
        // If we got less than requested, we've reached the end
        if (positions.length < batchSize) {
          hasMore = false;
          console.log('Received less positions than requested. Reached the end.');
        } else {
          // Prepare for the next batch
          skip += batchSize;
          
          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        console.log('No positions found in this batch. Stopping.');
        hasMore = false;
      }
    }
    
    console.log(`\nFetched a total of ${allPositions.length} positions.`);
    
    // Prepare summary data
    const summary = {
      totalPositions: allPositions.length,
      totalBorrowedUsd: allPositions.reduce((total, pos) => total + pos.borrowed.USD, 0),
      totalCollateralUsd: allPositions.reduce((total, pos) => total + pos.collateral.USD, 0),
    };
    
    // Add average LTV if we have valid values
    if (summary.totalCollateralUsd > 0) {
      summary.averageLtv = (summary.totalBorrowedUsd / summary.totalCollateralUsd) * 100;
    }
    
    // Create the final data object
    const outputData = {
      summary: summary,
      positions: allPositions
    };
    
    // Save to JSON file
    const outputFilePath = path.join('data', 'morpho_positions_all.json');
    fs.writeFileSync(outputFilePath, JSON.stringify(outputData, null, 2));
    
    console.log(`Data successfully saved to ${outputFilePath}.`);
    console.log('\n======= SUMMARY =======');
    console.log(`Total Positions: ${summary.totalPositions}`);
    console.log(`Total Borrowed: $${summary.totalBorrowedUsd.toFixed(2)}`);
    console.log(`Total Collateral: $${summary.totalCollateralUsd.toFixed(2)}`);
    
    if (summary.averageLtv) {
      console.log(`Average LTV: ${summary.averageLtv.toFixed(2)}%`);
    }

  } catch (error) {
    console.error('Error in fetching data:', error);
    console.log('Query failed');
  }
}

// Execute the main function
main(); 