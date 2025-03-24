import fetch from 'node-fetch';
import { 
  MORPHO_GRAPHQL_ENDPOINT, 
  USER_ADDRESS, 
  BLOCK_NUMBER 
} from './state/common.js';

// Constants
const BASE_CHAIN_ID = 8453; // Chain ID for Base network

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

// Function to fetch user by address - REQUIRES chainId parameter
async function fetchUserByAddress(userAddress, chainId) {
  const query = `
    {
      userByAddress(address: "${userAddress.toLowerCase()}", chainId: ${chainId}) {
        id
        address
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Function to fetch market positions for a user
async function fetchUserPositions(userId) {
  const query = `
    {
      marketPositions(
        first: 10,
        where: { userId_in: ["${userId}"] }
      ) {
        items {
          id
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
          supplyShares
          borrowShares
          collateral
          state {
            timestamp
          }
          healthFactor
        }
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Function to fetch transactions by user ID
async function fetchTransactionsByUserId(userId, limit = 50) {
  const query = `
    {
      transactions(
        first: ${limit},
        where: { userId_in: ["${userId}"] },
        orderBy: Timestamp,
        orderDirection: Desc
      ) {
        items {
          id
          hash
          blockNumber
          timestamp
          type
          user {
            id
            address
          }
        }
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Format timestamp to readable date
function formatTimestamp(timestamp) {
  return new Date(parseInt(timestamp) * 1000).toISOString();
}

// Format transaction data display
function formatTransactionData(tx) {
  // Format transaction type in a readable way
  let type = tx.type;
  if (type) {
    type = type.replace(/([A-Z])/g, ' $1').trim(); // Add spaces before capital letters
    type = type.charAt(0).toUpperCase() + type.slice(1); // Capitalize first letter
  }

  let output = [
    `Transaction: ${tx.hash}`,
    `Type: ${type || 'Unknown'}`,
    `Block: ${tx.blockNumber}`,
    `Time: ${formatTimestamp(tx.timestamp)}`
  ];
  
  return output.join('\n   ');
}

// Main function to orchestrate the queries
async function main() {
  try {
    const userAddress = process.argv[2] || USER_ADDRESS;
    const blockNumber = process.argv[3] || BLOCK_NUMBER;
    
    console.log(`\nFetching transaction history for user: ${userAddress}`);
    console.log(`Context block: ${blockNumber}\n`);
    
    // Step 1: Get the user by address
    const userData = await fetchUserByAddress(userAddress, BASE_CHAIN_ID);
    
    if (userData && userData.userByAddress) {
      const user = userData.userByAddress;
      console.log(`== User: ${user.address} ==`);
      console.log(`User ID: ${user.id}\n`);
      
      // Step 2: Try to get user positions
      try {
        console.log('Active Positions:');
        console.log('========================================');
        
        const positionsData = await fetchUserPositions(user.id);
        
        if (positionsData && 
            positionsData.marketPositions && 
            positionsData.marketPositions.items && 
            positionsData.marketPositions.items.length > 0) {
          
          positionsData.marketPositions.items.forEach((position, index) => {
            const market = position.market;
            console.log(`\n${index + 1}. Market: ${market.collateralAsset.symbol}/${market.loanAsset.symbol}`);
            console.log(`   Supply Shares: ${position.supplyShares || '0'}`);
            console.log(`   Borrow Shares: ${position.borrowShares || '0'}`);
            console.log(`   Collateral: ${position.collateral || '0'}`);
            
            if (position.healthFactor) {
              console.log(`   Health Factor: ${position.healthFactor}`);
            }
            
            if (position.state && position.state.timestamp) {
              console.log(`   Last Updated: ${formatTimestamp(position.state.timestamp)}`);
            }
          });
        } else {
          console.log('No active positions found.');
        }
      } catch (err) {
        console.log('No position data available.');
      }
      
      // Step 3: Get user transactions
      try {
        console.log('\nTransaction History:');
        console.log('========================================');
        
        const transactionsData = await fetchTransactionsByUserId(user.id);
        
        if (transactionsData && 
            transactionsData.transactions && 
            transactionsData.transactions.items && 
            transactionsData.transactions.items.length > 0) {
          
          transactionsData.transactions.items.forEach((tx, index) => {
            console.log(`\n${index + 1}. ${formatTransactionData(tx)}`);
          });
        } else {
          console.log('No transactions found.');
        }
      } catch (err) {
        console.log('Transaction data unavailable.');
        console.log('Consider using a blockchain explorer like Basescan to view transaction history.');
      }
      
    } else {
      console.log(`\nNo user data found for address: ${userAddress}`);
      console.log('Make sure the address is correct and has activity on the Base network.');
    }
    
  } catch (error) {
    console.error('\nError in fetching data:', error);
    console.log('\nQuery failed');
  }
}

// Export functions to be used in other modules
export { 
  fetchUserByAddress, 
  fetchUserPositions,
  fetchTransactionsByUserId,
  main 
};

// Execute the main function if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 