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
    }
  }
`;

// Main function to orchestrate the query
async function main() {
  const chainId = 8453; // Base Chain ID
  const assetSymbol = 'USDC'; // The loan asset for this market
  const decimals = 6;       // Decimals for USDC on Base

  try {
    console.log(`Querying Morpho Blue API for market liquidity...`);
    console.log(`Market Unique Key: ${CBBTC_USDC_MARKET_ID}`);
    console.log(`Chain ID: ${chainId}`);
    console.log(`Assuming Loan Asset: ${assetSymbol} (Decimals: ${decimals})`);

    const variables = {
        uniqueKey: CBBTC_USDC_MARKET_ID,
        chainId: chainId
    };
    const data = await makeGraphQLRequest(GET_MARKET_LIQUIDITY, variables);

    if (data && data.marketByUniqueKey) {
      const market = data.marketByUniqueKey;
      // const assetSymbol = market.asset?.symbol || 'N/A'; // Removed
      // const decimals = market.asset?.decimals || 18; // Removed

      // API returns values as strings, likely representing the smallest unit (e.g., 1 USDC = 1,000,000)
      // Convert to BigInt for safety, then format
      const reallocatableLiquidityRaw = BigInt(market.reallocatableLiquidityAssets || '0');
      const stateLiquidityRaw = BigInt(market.state?.liquidityAssets || '0');

      // Format the BigInt values to readable decimal strings
      const formatUnits = (value, dec) => {
          let str = value.toString();
          const len = str.length;
          if (len <= dec) {
              return '0.' + '0'.repeat(dec - len) + str;
          }
          return str.slice(0, len - dec) + '.' + str.slice(len - dec);
      };

      const reallocatableLiquidityFormatted = formatUnits(reallocatableLiquidityRaw, decimals);
      const stateLiquidityFormatted = formatUnits(stateLiquidityRaw, decimals);


      console.log(`
Market Found: ${market.uniqueKey} (${assetSymbol})`);
      console.log(`--------------------------------------------------`);
      console.log(`State Liquidity Assets (Raw):      ${market.state?.liquidityAssets || 'N/A'}`);
      console.log(`State Liquidity Assets (Formatted):  ${stateLiquidityFormatted} ${assetSymbol}`);
      console.log(`Reallocatable Liquidity (Raw):    ${market.reallocatableLiquidityAssets || 'N/A'}`);
      console.log(`Reallocatable Liquidity (Formatted): ${reallocatableLiquidityFormatted} ${assetSymbol}`);
      console.log(`--------------------------------------------------`);

      // Explanation of terms (based on potential Morpho Blue context):
      // - state.liquidityAssets: The total amount of the asset currently held idle in the market's buffer, available for borrowing.
      // - reallocatableLiquidityAssets: Liquidity supplied via MetaMorpho vaults that could potentially be moved between markets by allocators. This might overlap with or be part of state.liquidityAssets depending on the exact mechanism.

    } else {
      console.log('Market data not found via Morpho Blue API.');
    }

  } catch (error) {
    console.error('\nError fetching market liquidity from Morpho Blue API:', error.message);
  }
}

// Execute the main function
main(); 