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

// Query to get the Market type schema
const marketSchemaQuery = `
  {
    __type(name: "Market") {
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

// Query to get the MarketFilters type schema
const marketFiltersSchemaQuery = `
  {
    __type(name: "MarketFilters") {
      name
      kind
      inputFields {
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

// Function to explore the Market schema
async function exploreMarketSchema() {
  try {
    console.log('Exploring Market type schema...');
    const marketSchemaData = await makeGraphQLRequest(marketSchemaQuery);
    
    if (marketSchemaData.__type && marketSchemaData.__type.fields) {
      console.log('\nMarket Type Fields:');
      console.log('------------------');
      
      marketSchemaData.__type.fields.forEach(field => {
        const typeName = field.type.name || 
                         (field.type.ofType ? field.type.ofType.name : field.type.kind);
        console.log(`Field: ${field.name} (${typeName})`);
        if (field.description) console.log(`Description: ${field.description}`);
        console.log('---');
      });
    }
    
    return marketSchemaData;
  } catch (error) {
    console.error('Error exploring Market schema:', error);
  }
}

// Function to explore the MarketFilters schema
async function exploreMarketFiltersSchema() {
  try {
    console.log('\nExploring MarketFilters type schema...');
    const marketFiltersSchemaData = await makeGraphQLRequest(marketFiltersSchemaQuery);
    
    if (marketFiltersSchemaData.__type && marketFiltersSchemaData.__type.inputFields) {
      console.log('\nMarketFilters Type Fields:');
      console.log('------------------------');
      
      marketFiltersSchemaData.__type.inputFields.forEach(field => {
        const typeName = field.type.name || 
                         (field.type.ofType ? field.type.ofType.name : field.type.kind);
        console.log(`Field: ${field.name} (${typeName})`);
        if (field.description) console.log(`Description: ${field.description}`);
        console.log('---');
      });
    }
    
    return marketFiltersSchemaData;
  } catch (error) {
    console.error('Error exploring MarketFilters schema:', error);
  }
}

// Run both schema explorations
async function exploreSchemas() {
  try {
    await exploreMarketSchema();
    await exploreMarketFiltersSchema();
    console.log('\nSchema exploration completed');
  } catch (error) {
    console.error('Error in schema exploration:', error);
  }
}

// Execute
exploreSchemas()
  .catch(error => console.log('\nFailed to explore schemas:', error.message)); 