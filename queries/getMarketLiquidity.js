import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { CBBTC_USDC_MARKET_ID, MORPHO_GRAPHQL_ENDPOINT } from './state/common.js';

// Load environment variables from .env.private
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.private') });

// Function to make a direct GraphQL request
async function makeGraphQLRequest(query, variables = {}) {
  // Use the Morpho Blue API endpoint
  const endpoint = MORPHO_GRAPHQL_ENDPOINT;
  if (!endpoint) {
    // This check might not be strictly necessary if MORPHO_GRAPHQL_ENDPOINT is hardcoded in common.js
    throw new Error("MORPHO_GRAPHQL_ENDPOINT is not defined.");
  }
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Add API key header if needed for this endpoint - assuming none for now
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    const jsonResponse = await response.json();

    if (jsonResponse.errors) {
      console.error('GraphQL Errors:', jsonResponse.errors);
      throw new Error(`GraphQL request failed: ${JSON.stringify(jsonResponse.errors)}`);
    }

    if (!jsonResponse.data) {
        console.error('No data returned from GraphQL:', jsonResponse);
        throw new Error('No data returned from GraphQL request.');
    }

    return jsonResponse.data;
  } catch (error) {
    console.error(`Error making request to ${endpoint}:`, error);
    throw error;
  }
}

// Updated GraphQL query based on user's example
const GET_MARKET_LIQUIDITY = `
  query MarketByUniqueKey($uniqueKey: String!, $chainId: Int!) {
    marketByUniqueKey(uniqueKey: $uniqueKey, chainId: $chainId) {
      uniqueKey
      reallocatableLiquidityAssets
      state {
        liquidityAssets
      }
      publicAllocatorSharedLiquidity {
        assets
        vault {
          address
          name
        }
        allocationMarket {
          uniqueKey
        }
      }
    }
  }
`;

// Main function to orchestrate the query
async function main() {
  const chainId = 8453; // Base Chain ID

  try {
    const variables = {
        uniqueKey: CBBTC_USDC_MARKET_ID,
        chainId: chainId
    };
    const data = await makeGraphQLRequest(GET_MARKET_LIQUIDITY, variables);

    if (data && data.marketByUniqueKey) {
      const market = data.marketByUniqueKey;

      // Get the raw reallocatable liquidity
      const reallocatableLiquidityRaw = market.reallocatableLiquidityAssets || '0';

      // Output ONLY the raw reallocatable liquidity value
      console.log(reallocatableLiquidityRaw);

    } else {
      // Optionally log an error to stderr or output a specific value like '0' or 'Error' on failure
      // For now, just outputting '0' if market not found
      console.log('0');
    }

  } catch (error) {
    // Log errors to stderr to avoid polluting stdout
    console.error('Error fetching market liquidity:', error.message);
    // Output '0' or another indicator on error
    console.log('0'); 
  }
}

// Execute the main function
main(); 