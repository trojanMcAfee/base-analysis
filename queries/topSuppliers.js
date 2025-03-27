import fetch from 'node-fetch';
import { CBBTC_USDC_MARKET_ID, getBaseSubgraphEndpoint } from './state/common.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchMarketById } from './supplyBorrowLiq.js';

// Load environment variables from .env.private
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.private') });

// Function to make a GraphQL request
async function makeGraphQLRequest(query, variables = {}) {
  try {
    // Ensure we have the API key
    const apiKey = process.env.THE_GRAPH_API_KEY;
    if (!apiKey) {
      throw new Error('THE_GRAPH_API_KEY is not defined in environment variables');
    }

    // Get the subgraph endpoint with the API key
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

// Function to fetch suppliers for the cbBTC/USDC market
async function fetchUsdcSuppliers(skip, batchSize) {
  const query = `
    {
      positions(
        first: ${batchSize}
        skip: ${skip}
        where: {
          supplyShares_gt: "0",
          marketId: "${CBBTC_USDC_MARKET_ID}"
        }
      ) {
        id
        user {
          id
        }
        market {
          id
          borrowedToken {
            symbol
            decimals
          }
        }
        supplyShares
        supplyAssets
        updatedAt
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
    const marketData = await fetchMarketById(CBBTC_USDC_MARKET_ID);
    if (!marketData.market) {
      console.error('Failed to fetch market data');
      return;
    }
    
    const totalSupply = parseFloat(marketData.market.totalSupply) / (10 ** marketData.market.borrowedToken.decimals);
    console.log(`Total USDC supplied to cbBTC/USDC market: ${totalSupply.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`);
    
    // Parameters for fetching suppliers
    const batchSize = 100;
    let skip = 0;
    let allSuppliers = [];
    
    console.log('Fetching suppliers...');
    const suppliersData = await fetchUsdcSuppliers(skip, batchSize);
    
    if (suppliersData.positions) {
      const suppliers = suppliersData.positions;
      
      // Process each supplier position
      const formattedSuppliers = suppliers.map(position => {
        const userAddress = position.user.id;
        const decimals = position.market.borrowedToken.decimals;
        const decimalFactor = 10 ** decimals;
        
        // Parse values
        const supplyAmount = position.supplyAssets ? parseFloat(position.supplyAssets) / decimalFactor : 0;
        const supplyUsd = supplyAmount; // For USDC, 1:1 with USD
        
        // Calculate percentage of total
        const percentOfTotal = totalSupply > 0 ? (supplyAmount / totalSupply) * 100 : 0;
        
        return {
          userAddress: userAddress,
          suppliedUSDC: supplyAmount,
          suppliedUSD: supplyUsd,
          percentOfTotal: percentOfTotal,
          lastUpdated: position.updatedAt ? new Date(parseInt(position.updatedAt) * 1000).toISOString() : 'N/A'
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