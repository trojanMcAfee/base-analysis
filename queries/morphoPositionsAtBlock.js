import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { 
  CBBTC_USDC_MARKET_ID, 
  BLOCK_NUMBER, 
  parseLLTVToDecimal, 
  getBaseSubgraphEndpoint 
} from './state/common.js';
import { fetchBTCPrice } from './btcPrice.js';

// Load environment variables from .env.private
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.private') });

// Function to make a direct GraphQL request to the Base subgraph
async function makeGraphQLRequest(query, variables = {}) {
  try {
    const response = await fetch(getBaseSubgraphEndpoint(), {
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

// Function to fetch market data to get LLTV value
async function fetchMarketData() {
  const query = `
    {
      markets(
        where: { id: "${CBBTC_USDC_MARKET_ID}" }
        block: { number: ${BLOCK_NUMBER} }
      ) {
        id
        name
        liquidationThreshold
        maximumLTV
        totalBorrow
        totalCollateral
        totalValueLockedUSD
        borrowedToken {
          symbol
          decimals
        }
        inputToken {
          symbol
          decimals
        }
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Function to fetch all positions for the CBBTC/USDC market at a specific block
async function fetchAllPositionsAtBlock(first = 100, skip = 0) {
  const query = `
    {
      positions(
        first: ${first}
        skip: ${skip}
        block: { number: ${BLOCK_NUMBER} }
        where: {
          market: "${CBBTC_USDC_MARKET_ID}",
          hashClosed: null
        }
      ) {
        id
        account {
          id
        }
        market {
          id
          name
        }
        side
        isCollateral
        balance
        shares
        asset {
          id
          symbol
          decimals
        }
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Main function to orchestrate the query
async function main() {
  try {
    console.log(`Fetching all positions for cbBTC/USDC market (ID: ${CBBTC_USDC_MARKET_ID}) at block ${BLOCK_NUMBER}...`);
    
    // Create data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Fetch current BTC price using the imported function
    console.log('Fetching current BTC price...');
    const btcPriceData = await fetchBTCPrice();
    const collateralPriceUSD = btcPriceData.price;
    
    // Fetch market data first to get the LLTV and other market details
    console.log('Fetching market data...');
    const marketData = await fetchMarketData();
    
    if (!marketData.markets || marketData.markets.length === 0) {
      console.error('Market not found.');
      return;
    }
    
    const market = marketData.markets[0];
    console.log(`Market: ${market.name}`);
    
    // Parse LLTV (use a fixed value if not available or is zero)
    let lltvDecimal = parseLLTVToDecimal(market.liquidationThreshold);
    if (lltvDecimal === 0 || isNaN(lltvDecimal)) {
      lltvDecimal = 0.85; // Use a typical Morpho LLTV as fallback (85%)
      console.log(`Using default Liquidation Threshold: ${(lltvDecimal * 100).toFixed(2)}% since market value was 0`);
    } else {
      console.log(`Market Liquidation Threshold: ${(lltvDecimal * 100).toFixed(2)}%`);
    }
    
    // Parse token decimal factors
    const borrowDecimalFactor = 10 ** (market.borrowedToken?.decimals || 6); // Default to 6 for USDC
    const collateralDecimalFactor = 10 ** (market.inputToken?.decimals || 8); // Default to 8 for BTC
    
    console.log(`${market.inputToken.symbol} Price: $${collateralPriceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    
    // Fetch all positions with pagination
    console.log(`Fetching all open positions...`);
    let allPositions = [];
    let hasMorePositions = true;
    let skip = 0;
    const batchSize = 100;
    
    while (hasMorePositions) {
      console.log(`Fetching positions ${skip} to ${skip + batchSize - 1}...`);
      const positionsData = await fetchAllPositionsAtBlock(batchSize, skip);
      
      if (!positionsData.positions || positionsData.positions.length === 0) {
        console.log('No more positions to fetch.');
        hasMorePositions = false;
        break;
      }
      
      // Process positions in this batch
      allPositions = [...allPositions, ...positionsData.positions];
      
      // If we got fewer positions than requested, we've reached the end
      if (positionsData.positions.length < batchSize) {
        hasMorePositions = false;
      } else {
        // Prepare for next batch
        skip += batchSize;
        
        // Add a small delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`\nFetched a total of ${allPositions.length} positions.`);
    
    // Group positions by account
    const positionsByAccount = {};
    
    allPositions.forEach(position => {
      const accountId = position.account.id;
      if (!positionsByAccount[accountId]) {
        positionsByAccount[accountId] = {
          borrowerPosition: null,
          collateralPosition: null
        };
      }
      
      if (position.side === "BORROWER") {
        positionsByAccount[accountId].borrowerPosition = position;
      } else if (position.isCollateral) {
        positionsByAccount[accountId].collateralPosition = position;
      }
    });
    
    // Filter accounts with both borrower and collateral positions
    const accountsWithBothPositions = Object.entries(positionsByAccount)
      .filter(([_, positions]) => positions.borrowerPosition && positions.collateralPosition);
    
    console.log(`\nFound ${accountsWithBothPositions.length} accounts with both borrower and collateral positions.`);
    
    // Format positions for output
    const formattedPositions = accountsWithBothPositions.map(([accountId, positions], index) => {
      // Format borrower position
      const borrowerPosition = positions.borrowerPosition;
      const borrowAmount = borrowerPosition.balance ? parseFloat(borrowerPosition.balance) / borrowDecimalFactor : 0;
      
      // Format collateral position
      const collateralPosition = positions.collateralPosition;
      const collateralAmount = collateralPosition.balance ? parseFloat(collateralPosition.balance) / collateralDecimalFactor : 0;
      
      // Calculate USD values
      const collateralUSD = collateralAmount * collateralPriceUSD;
      const borrowedUSD = borrowAmount; // For USDC, 1:1 with USD
      
      // Calculate liquidation price with safety checks
      let liquidationPrice = 0;
      if (collateralAmount > 0 && borrowAmount > 0 && lltvDecimal > 0) {
        liquidationPrice = borrowAmount / (collateralAmount * lltvDecimal);
        
        // Sanity check for liquidation price
        if (liquidationPrice > 1000000) {
          liquidationPrice = borrowAmount / (collateralAmount * 0.85); // Try with default 85% LLTV
          
          // If still too high, cap it
          if (liquidationPrice > 1000000) {
            liquidationPrice = Math.min(liquidationPrice, 100000); // Cap at $100k
          }
        }
      }
      
      return {
        position: index + 1,
        userAddress: accountId,
        collateral: {
          cbBTC: collateralAmount,
          USD: collateralUSD
        },
        borrowed: {
          USDC: borrowAmount,
          USD: borrowedUSD
        },
        liquidationPrice: liquidationPrice
      };
    });
    
    // Calculate summary data
    const summary = {
      totalPositions: formattedPositions.length,
      totalBorrowedUsd: formattedPositions.reduce((total, pos) => total + pos.borrowed.USD, 0),
      totalCollateralUsd: formattedPositions.reduce((total, pos) => total + pos.collateral.USD, 0),
    };
    
    // Add average LTV if we have valid values
    if (summary.totalCollateralUsd > 0) {
      summary.averageLtv = (summary.totalBorrowedUsd / summary.totalCollateralUsd) * 100;
    }
    
    // Calculate average liquidation price on positions that have a non-zero value
    const validLiqPrices = formattedPositions.filter(pos => pos.liquidationPrice > 0 && pos.liquidationPrice < 1000000);
    if (validLiqPrices.length > 0) {
      const avgLiqPrice = validLiqPrices.reduce((total, pos) => total + pos.liquidationPrice, 0) / validLiqPrices.length;
      summary.averageLiquidationPrice = avgLiqPrice;
    }
    
    // Create the final data object
    const outputData = {
      summary: summary,
      positions: formattedPositions
    };
    
    // Display some statistics
    console.log(`\n======= SUMMARY =======`);
    console.log(`Total Positions: ${summary.totalPositions}`);
    console.log(`Total Borrowed: $${summary.totalBorrowedUsd.toFixed(2)}`);
    console.log(`Total Collateral: $${summary.totalCollateralUsd.toFixed(2)}`);
    
    if (summary.averageLtv) {
      console.log(`Average LTV: ${summary.averageLtv.toFixed(2)}%`);
    }
    
    if (summary.averageLiquidationPrice) {
      console.log(`Average Liquidation Price: $${summary.averageLiquidationPrice.toFixed(2)}`);
    }
    
    // Display the first 10 positions in detail (to avoid console overflow)
    console.log(`\n===== First Few Positions =====`);
    const displayCount = Math.min(10, formattedPositions.length);
    formattedPositions.slice(0, displayCount).forEach((pos, index) => {
      console.log(`\nPosition ${index + 1}:`);
      console.log(`  User: ${pos.userAddress}`);
      console.log(`  Collateral: ${pos.collateral.cbBTC.toFixed(8)} ${market.inputToken.symbol} ($${pos.collateral.USD.toFixed(2)})`);
      console.log(`  Borrowed: ${pos.borrowed.USDC.toFixed(2)} ${market.borrowedToken.symbol} ($${pos.borrowed.USD.toFixed(2)})`);
      console.log(`  Liquidation Price: $${pos.liquidationPrice.toFixed(2)}`);
    });
    
    if (formattedPositions.length > displayCount) {
      console.log(`\n... and ${formattedPositions.length - displayCount} more positions`);
    }
    
    // Save to JSON file
    const outputFilePath = path.join('data', `morpho_positions_block_${BLOCK_NUMBER}.json`);
    fs.writeFileSync(outputFilePath, JSON.stringify(outputData, null, 2));
    
    console.log(`\nData successfully saved to ${outputFilePath}.`);

  } catch (error) {
    console.error('Error in fetching data:', error);
    console.log('Query failed');
  }
}

// Execute the main function
main(); 