const fetch = require('node-fetch');

// The GraphQL endpoint for Morpho's API
const endpoint = 'https://blue-api.morpho.org/graphql';

// Function to make a direct GraphQL request
async function makeGraphQLRequest(query, variables = {}) {
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
      console.error('GraphQL Errors:', jsonResponse.errors);
      throw new Error('GraphQL request failed');
    }
    
    return jsonResponse.data;
  } catch (error) {
    console.error('Error making request:', error);
    throw error;
  }
}

// Query to get the MarketState type schema
const marketStateSchemaQuery = `
  {
    __type(name: "MarketState") {
      name
      kind
      fields {
        name
        description
        type {
          name
          kind
          ofType {
            name
            kind
          }
        }
      }
    }
  }
`;

// Function to explore the MarketState schema
async function exploreMarketStateSchema() {
  try {
    console.log('Exploring MarketState type schema...');
    const marketStateSchemaData = await makeGraphQLRequest(marketStateSchemaQuery);
    
    if (marketStateSchemaData.__type && marketStateSchemaData.__type.fields) {
      console.log('\nMarketState Type Fields:');
      console.log('----------------------');
      
      marketStateSchemaData.__type.fields.forEach(field => {
        const typeName = field.type.name || 
                         (field.type.ofType ? field.type.ofType.name : field.type.kind);
        console.log(`Field: ${field.name} (${typeName})`);
        if (field.description) console.log(`Description: ${field.description}`);
        console.log('---');
      });
    }
    
    return marketStateSchemaData;
  } catch (error) {
    console.error('Error exploring MarketState schema:', error);
  }
}

// Execute
exploreMarketStateSchema()
  .then(() => console.log('\nSchema exploration completed'))
  .catch(error => console.log('\nFailed to explore schema:', error.message)); 