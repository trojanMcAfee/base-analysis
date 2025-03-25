import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.private
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.private') });

const API_KEY = process.env.THE_GRAPH_API_KEY;
const SUBGRAPH_ID = '71ZTy1veF9twER9CLMnPWeLQ7GZcwKsjmygejrgKirqs';
const SUBGRAPH_ENDPOINT = `https://gateway.thegraph.com/api/${API_KEY}/subgraphs/id/${SUBGRAPH_ID}`;

// Function to make a direct GraphQL request
async function makeGraphQLRequest(query, variables = {}) {
  try {
    const response = await fetch(SUBGRAPH_ENDPOINT, {
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
    console.log('Querying Base chain subgraph schema...');
    
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
    
    // Look for market related types
    console.log('\nLooking for types related to markets or rates:');
    const relevantTypes = schemaData.__schema.types.filter(type => 
      type.name && 
      type.kind === 'OBJECT' && 
      (type.name.includes('Market') || 
       type.name.includes('Rate') || 
       type.name.includes('Borrow') || 
       type.name.includes('APY'))
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
      console.log('No market or rate types found. Showing all object types:');
      
      // Fallback to showing all object types
      const objectTypes = schemaData.__schema.types.filter(type => 
        type.name && 
        type.kind === 'OBJECT' && 
        !type.name.startsWith('__')
      );
      
      objectTypes.forEach(type => {
        console.log(`\nType: ${type.name}`);
      });
    }

  } catch (error) {
    console.error('Error in fetching schema:', error);
    console.log('Schema query failed');
  }
}

// Execute the main function
main(); 