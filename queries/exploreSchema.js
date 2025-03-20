const { request, gql } = require('graphql-request');

// The GraphQL endpoint for Morpho's API
const endpoint = 'https://blue-api.morpho.org/graphql';

// Define the introspection query
const introspectionQuery = gql`
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
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
          type {
            kind
            name
            ofType {
              kind
              name
            }
          }
        }
      }
    }
  }
`;

// Function to fetch the schema
async function fetchSchema() {
  try {
    console.log('Fetching GraphQL schema...');
    const data = await request(endpoint, introspectionQuery);
    
    console.log('\nAPI Query Fields:');
    console.log('-----------------');
    
    if (data.__schema && data.__schema.queryType) {
      data.__schema.queryType.fields.forEach(field => {
        console.log(`Field: ${field.name}`);
        if (field.description) console.log(`Description: ${field.description}`);
        console.log(`Return Type: ${field.type.name || field.type.ofType?.name || field.type.kind}`);
        if (field.args.length > 0) {
          console.log('Arguments:');
          field.args.forEach(arg => {
            const typeName = arg.type.name || (arg.type.ofType ? arg.type.ofType.name : arg.type.kind);
            console.log(`- ${arg.name} (${typeName}): ${arg.description || 'No description'}`);
          });
        }
        console.log('---');
      });
    } else {
      console.log('Schema structure not as expected.');
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching schema:', error);
    throw error;
  }
}

// Execute the function
fetchSchema()
  .then(() => console.log('Schema introspection completed'))
  .catch(() => console.log('Schema introspection failed')); 