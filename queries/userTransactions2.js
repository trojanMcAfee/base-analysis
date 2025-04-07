import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  // USER_ADDRESS, // No longer needed
  // BLOCK_NUMBER, // No longer needed
  getBaseSubgraphEndpoint
} from './state/common.js';

// Load environment variables from .env.private
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env.private');
// console.log(`Attempting to load environment variables from: ${envPath}`); // Removed debug log
dotenv.config({ path: envPath });
// console.log(`Value of GOLDSKY_API_URL after dotenv load: ${process.env.GOLDSKY_API_URL}`); // Removed debug log

// Function to make a direct GraphQL request to the Base Subgraph
async function makeGraphQLRequest(query, variables = {}) {
  const endpoint = getBaseSubgraphEndpoint();
  if (!endpoint) {
    // console.error(`Error: GOLDSKY_API_URL environment variable was not loaded successfully. Check the file at ${envPath} exists and contains the variable.`); // Removed debug log
    throw new Error('GOLDSKY_API_URL environment variable not set.');
  }
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
      console.error('GraphQL Errors:', JSON.stringify(jsonResponse.errors, null, 2));
      // Attempt to return partial data if available
      if (jsonResponse.data) {
        console.warn('Partial data returned despite errors.');
        return jsonResponse.data;
      }
      throw new Error('GraphQL request failed');
    }
    
    return jsonResponse.data;
  } catch (error) {
    console.error('Error making request to subgraph:', error);
    throw error;
  }
}

// Function to fetch all relevant transaction types for a user
async function fetchAllUserTransactions(userAddress, limitPerType = 10) {
  const userAddressLower = userAddress.toLowerCase();
  const transactionTypes = ['deposits', 'withdraws', 'borrows', 'repays', 'liquidates'];
  let allTransactions = [];

  const queryTemplate = (type) => `
    query GetUser${type.charAt(0).toUpperCase() + type.slice(1)}($userAddress: String!, $limit: Int!) {
      ${type}(
        first: $limit,
        where: { account: $userAddress },
        orderBy: timestamp,
        orderDirection: desc
      ) {
        id
        hash
        blockNumber
        timestamp
        market {
          inputToken {
            symbol
          }
        }
      }
    }
  `;

  console.log(`Fetching latest ${limitPerType} transactions of each type for user ${userAddress}...`);

  for (const type of transactionTypes) {
      try {
          const query = queryTemplate(type);
          const variables = { userAddress: userAddressLower, limit: limitPerType };
          const data = await makeGraphQLRequest(query, variables);
          
          if (data && data[type] && data[type].length > 0) {
              const transactions = data[type].map(tx => ({
                  ...tx,
                  type: type.slice(0, -1) // Add type info (e.g., 'deposit')
              }));
              allTransactions = allTransactions.concat(transactions);
              console.log(`  Fetched ${transactions.length} ${type}.`);
          } else {
              console.log(`  No ${type} found.`);
          }
      } catch (error) {
          console.warn(`  Could not fetch ${type}: ${error.message}`);
      }
  }

  // Sort all collected transactions by timestamp descending
  allTransactions.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));

  return allTransactions;
}


// Format timestamp to readable date
function formatTimestamp(timestamp) {
  // Subgraph timestamps are usually in seconds
  return new Date(parseInt(timestamp) * 1000).toISOString();
}

// Format transaction data display
function formatTransactionData(tx) {
  let type = tx.type || 'Unknown';
  type = type.charAt(0).toUpperCase() + type.slice(1); // Capitalize first letter

  let output = [
    `Transaction: ${tx.hash}`,
    `Type: ${type}`,
    `Block: ${tx.blockNumber}`,
    `Time: ${formatTimestamp(tx.timestamp)}`,
    `Market Token: ${tx.market?.inputToken?.symbol || 'N/A'}`
  ];
  
  return output.join('\n   ');
}

// Main function to orchestrate the queries
async function main() {
  try {
    // Hardcode the user address
    const userAddress = '0x9e607f673af8d0Adc840605845F0a5A79924709f';
    // const blockNumber = process.argv[3] || BLOCK_NUMBER; // Block number context is not used
    
    console.log(`\nFetching transaction history for user: ${userAddress}`);
    // console.log(`Reference block (not used in query): ${blockNumber}\n`); // Removed as block number is not used
    
    // Step 1: Get all transaction types
    const transactions = await fetchAllUserTransactions(userAddress, 50); // Fetch up to 50 of each type

    if (transactions.length > 0) {
        console.log('\nCombined Transaction History (Sorted by Time):');
        console.log('===============================================');
        transactions.forEach((tx, index) => {
            console.log(`\n${index + 1}. ${formatTransactionData(tx)}`);
        });
        console.log(`\nTotal transactions found across types: ${transactions.length}`);

    } else {
        console.log(`\nNo transaction data found for address: ${userAddress} using the Base subgraph.`);
        console.log('Make sure the address is correct and has activity on the Base network.');
    }
    
    // Note: Fetching user positions would require a separate query to 'positions' or 'marketPositions' 
    // entities based on the exact schema and desired data. This is omitted for now as the request
    // focused on achieving the same *transaction* querying result.

  } catch (error) {
    console.error('\nError in fetching data:', error);
    console.log('\nQuery failed');
  }
}

// Execute the main function if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Export functions if needed for use in other modules (optional)
export { 
  fetchAllUserTransactions,
  main 
}; 