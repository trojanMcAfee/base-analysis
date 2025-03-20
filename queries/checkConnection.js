const { request, gql } = require('graphql-request');

// The GraphQL endpoint for Morpho's API
const endpoint = 'https://blue-api.morpho.org/graphql';

// A simple query to get chain information
const query = gql`
  query GetChains {
    chains {
      id
      name
      lastBlockNumber
    }
  }
`;

// Function to fetch chain data
async function testConnection() {
  try {
    console.log('Testing connection to Morpho GraphQL API...');
    const data = await request(endpoint, query);
    
    console.log('\nConnection successful!');
    
    if (data.chains) {
      console.log('\nChains information:');
      console.log('------------------');
      
      data.chains.forEach(chain => {
        console.log(`Chain ID: ${chain.id}`);
        console.log(`Name: ${chain.name}`);
        console.log(`Last Block: ${chain.lastBlockNumber}`);
        console.log('---');
      });
    }
    
    return data;
  } catch (error) {
    console.error('Error connecting to API:', error);
    if (error.response && error.response.errors) {
      console.error('GraphQL Errors:', error.response.errors);
    }
    throw error;
  }
}

// Execute the function
testConnection()
  .then(() => console.log('\nTest completed successfully'))
  .catch(() => console.log('\nTest failed')); 