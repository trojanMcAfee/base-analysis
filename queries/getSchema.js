import fetch from 'node-fetch';
import { MORPHO_GRAPHQL_ENDPOINT } from './state/common.js';

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

// GraphQL introspection query to get schema information
async function getSchema() {
  const query = `
    query IntrospectionQuery {
      __schema {
        queryType {
          name
          fields {
            name
            description
            args {
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
        types {
          name
          kind
          description
          fields {
            name
            description
            args {
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
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Main function to orchestrate the query
async function main() {
  try {
    console.log('Querying GraphQL schema...');
    
    // Get schema information
    const schemaData = await getSchema();
    
    // Extract query fields to see available queries
    console.log('\nAvailable Query Fields:');
    const queryFields = schemaData.__schema.queryType.fields;
    queryFields.forEach(field => {
      console.log(`- ${field.name}`);
      if (field.args && field.args.length > 0) {
        console.log('  Arguments:');
        field.args.forEach(arg => {
          console.log(`    ${arg.name}: ${arg.type.name || arg.type.kind}`);
          if (arg.type.ofType) {
            console.log(`      (of type: ${arg.type.ofType.name || arg.type.ofType.kind})`);
          }
        });
      }
    });
    
    // Find types related to positions/accounts
    console.log('\nLooking for types related to positions or accounts:');
    const relevantTypes = schemaData.__schema.types.filter(type => 
      type.name && 
      type.kind === 'OBJECT' && 
      (type.name.includes('Position') || type.name.includes('Account'))
    );
    
    if (relevantTypes.length > 0) {
      relevantTypes.forEach(type => {
        console.log(`\nType: ${type.name}`);
        if (type.fields) {
          console.log('  Fields:');
          type.fields.forEach(field => {
            console.log(`    - ${field.name}: ${field.type.name || field.type.kind}`);
            if (field.type.ofType) {
              console.log(`        (of type: ${field.type.ofType.name || field.type.ofType.kind})`);
            }
          });
        }
      });
    } else {
      console.log('No position or account types found.');
    }

  } catch (error) {
    console.error('Error in fetching schema:', error);
    console.log('Schema query failed');
  }
}

// Execute the main function
main(); 