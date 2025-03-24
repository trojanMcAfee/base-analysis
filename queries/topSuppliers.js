import fetch from 'node-fetch';
import { MORPHO_GRAPHQL_ENDPOINT, GRAPHQL_MARKET_ID } from './state/common.js';
import { fetchMarketById } from './supplyBorrowLiq.js';

// Function to make a GraphQL request
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

// Function to fetch suppliers for the cbBTC/USDC market
async function fetchUsdcSuppliers(skip, batchSize) {
  const query = `
    {
      marketPositions(
        first: ${batchSize}
        skip: ${skip}
        where: {
          supplyShares_gte: "1",
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
          }
          supplyShares
          supplyAssets
          state {
            supplyAssetsUsd
            timestamp
          }
        }
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Main function to execute the query
async function main() {
  try {
    console.log('Fetching top USDC suppliers for cbBTC/USDC market on Base...');
    
    // First, fetch the market data to get the total supply amount
    const marketData = await fetchMarketById(GRAPHQL_MARKET_ID);
    if (!marketData.market || !marketData.market.state) {
      console.error('Failed to fetch market data');
      return;
    }
    
    const totalSupply = parseFloat(marketData.market.state.supplyAssets) / (10 ** marketData.market.loanAsset.decimals);
    console.log(`Total USDC supplied to cbBTC/USDC market: ${totalSupply.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`);
    
    // Parameters for fetching suppliers
    const batchSize = 100;
    let skip = 0;
    let allSuppliers = [];
    
    console.log('Fetching suppliers...');
    const suppliersData = await fetchUsdcSuppliers(skip, batchSize);
    
    if (suppliersData.marketPositions && suppliersData.marketPositions.items) {
      const suppliers = suppliersData.marketPositions.items;
      
      // Process each supplier position
      const formattedSuppliers = suppliers.map(position => {
        const userAddress = position.user.address;
        const decimals = position.market.loanAsset.decimals;
        const decimalFactor = 10 ** decimals;
        
        // Parse values
        const supplyAmount = position.supplyAssets ? parseFloat(position.supplyAssets) / decimalFactor : 0;
        const supplyUsd = position.state.supplyAssetsUsd ? parseFloat(position.state.supplyAssetsUsd) : supplyAmount; // For USDC, 1:1 with USD
        
        // Calculate percentage of total
        const percentOfTotal = totalSupply > 0 ? (supplyAmount / totalSupply) * 100 : 0;
        
        return {
          userAddress: userAddress,
          suppliedUSDC: supplyAmount,
          suppliedUSD: supplyUsd,
          percentOfTotal: percentOfTotal,
          lastUpdated: position.state.timestamp ? new Date(parseInt(position.state.timestamp) * 1000).toISOString() : 'N/A'
        };
      });
      
      allSuppliers = formattedSuppliers;
    } else {
      console.log('No suppliers found for this market.');
      return;
    }
    
    // Sort suppliers by USDC supply amount (descending)
    allSuppliers.sort((a, b) => b.suppliedUSDC - a.suppliedUSDC);
    
    // Get the top 3 suppliers
    const top3Suppliers = allSuppliers.slice(0, 3);
    
    console.log('\nTop 3 USDC Suppliers for cbBTC/USDC Market:');
    console.log('---------------------------------------------');
    
    // Display the top 3 suppliers with percentage
    top3Suppliers.forEach((supplier, index) => {
      console.log(`#${index + 1}: ${supplier.userAddress}`);
      console.log(`   Supplied USDC: ${supplier.suppliedUSDC.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
      console.log(`   USD Value: $${supplier.suppliedUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
      console.log(`   % of Total Supply: ${supplier.percentOfTotal.toFixed(2)}%`);
      console.log(`   Last Updated: ${supplier.lastUpdated}`);
      console.log('---------------------------------------------');
    });
    
  } catch (error) {
    console.error('Error fetching top USDC suppliers:', error);
  }
}

// Execute the main function if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 