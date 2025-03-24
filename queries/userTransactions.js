import fetch from 'node-fetch';
import { 
  MORPHO_GRAPHQL_ENDPOINT, 
  USER_ADDRESS, 
  BLOCK_NUMBER 
} from './state/common.js';

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

// Function to fetch user by address including their positions
async function fetchUserByAddress(userAddress) {
  const query = `
    {
      userByAddress(address: "${userAddress.toLowerCase()}") {
        id
        address
        totalValueUsd
        positions {
          id
          market {
            id
            name
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
          collateralShares
          lastUpdate
          healthFactor
        }
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Main function to orchestrate the queries
async function main() {
  try {
    const userAddress = process.argv[2] || USER_ADDRESS;
    const blockNumber = process.argv[3] || BLOCK_NUMBER;
    
    console.log(`\nFetching user data for: ${userAddress}`);
    console.log(`Context block: ${blockNumber}\n`);
    
    // Fetch user details
    const userData = await fetchUserByAddress(userAddress);
    
    // Display user positions if available
    if (userData && userData.userByAddress) {
      const user = userData.userByAddress;
      console.log(`== User: ${user.address} ==`);
      console.log(`Total Value (USD): ${user.totalValueUsd || 'Not available'}`);
      
      if (user.positions && user.positions.length > 0) {
        console.log('\nActive Positions:');
        console.log('========================================');
        
        user.positions.forEach((position, index) => {
          console.log(`\n${index + 1}. Market: ${position.market.collateralAsset.symbol}/${position.market.loanAsset.symbol}`);
          
          // Format shares with correct decimals
          const formatShares = (shares, decimals) => {
            if (!shares || shares === '0') return '0';
            const decimalFactor = 10 ** (parseInt(decimals) || 0);
            return (parseFloat(shares) / decimalFactor).toFixed(6);
          };
          
          // Display position details
          console.log(`   Supply: ${formatShares(position.supplyShares, position.market.loanAsset.decimals)} ${position.market.loanAsset.symbol}`);
          console.log(`   Borrow: ${formatShares(position.borrowShares, position.market.loanAsset.decimals)} ${position.market.loanAsset.symbol}`);
          console.log(`   Collateral: ${formatShares(position.collateralShares, position.market.collateralAsset.decimals)} ${position.market.collateralAsset.symbol}`);
          
          if (position.healthFactor) {
            console.log(`   Health Factor: ${position.healthFactor}`);
          }
          
          console.log(`   Last Updated: ${new Date(parseInt(position.lastUpdate) * 1000).toISOString()}`);
        });
      } else {
        console.log('\nNo active positions found.');
      }
    } else {
      console.log(`\nNo user data found for address: ${userAddress}`);
    }
    
    console.log('\nNote: Transaction history is not available through the GraphQL API at this time.');
    console.log('Consider using a blockchain explorer like Basescan to view transaction history.');
    
  } catch (error) {
    console.error('\nError in fetching data:', error);
    console.log('\nQuery failed');
  }
}

// Export functions to be used in other modules
export { fetchUserByAddress, main };

// Execute the main function if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 