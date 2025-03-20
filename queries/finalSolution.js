const fetch = require('node-fetch');

// The GraphQL endpoint for Morpho's API
const endpoint = 'https://blue-api.morpho.org/graphql';

// The market ID we're interested in for Base
const MARKET_ID = '0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836';

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

// Let's first get the Market type schema to understand its structure
async function getMarketSchema() {
  const schemaQuery = `
    {
      __type(name: "Market") {
        name
        fields {
          name
          type {
            name
            kind
          }
        }
      }
    }
  `;
  
  try {
    console.log('Querying for Market type schema...');
    const schemaData = await makeGraphQLRequest(schemaQuery);
    console.log('Market fields:', JSON.stringify(schemaData.__type.fields, null, 2));
    return schemaData.__type.fields;
  } catch (error) {
    console.error('Error querying Market schema:', error);
    throw error;
  }
}

// Query for MarketState fields
async function getMarketStateSchema() {
  const schemaQuery = `
    {
      __type(name: "MarketState") {
        name
        fields {
          name
        }
      }
    }
  `;
  
  try {
    console.log('\nQuerying for MarketState schema fields...');
    const schemaData = await makeGraphQLRequest(schemaQuery);
    console.log('MarketState fields:', JSON.stringify(schemaData.__type.fields, null, 2));
    return schemaData.__type.fields;
  } catch (error) {
    console.error('Error querying MarketState schema:', error);
    throw error;
  }
}

// Query the market data with the correct field names
async function getMarketData(marketFields, marketStateFields) {
  // Find the supply and borrow fields in MarketState
  const supplyField = marketStateFields.find(f => f.name.includes('supply') && f.name.includes('Assets'))?.name;
  const borrowField = marketStateFields.find(f => f.name.includes('borrow') && f.name.includes('Assets'))?.name;
  
  if (!supplyField || !borrowField) {
    console.log('Could not find the supply or borrow fields in MarketState.');
    return;
  }
  
  console.log(`\nUsing fields: ${supplyField} and ${borrowField}`);
  
  // Build a market query using the correct field names from our schema exploration
  const marketQuery = `
    {
      market(id: "${MARKET_ID}") {
        id
        loanAsset {
          symbol
          decimals
          address
        }
        collateralAsset {
          symbol
          decimals
          address
        }
        state {
          ${supplyField}
          ${borrowField}
        }
      }
    }
  `;
  
  try {
    console.log(`\nFetching data for market ID: ${MARKET_ID}`);
    const marketData = await makeGraphQLRequest(marketQuery);
    
    if (!marketData.market) {
      console.log(`No market found with ID: ${MARKET_ID}`);
      return;
    }
    
    console.log('\nMarket Data:');
    console.log('-----------');
    console.log(`Market ID: ${marketData.market.id}`);
    
    if (marketData.market.loanAsset) {
      console.log(`Loan Asset: ${marketData.market.loanAsset.symbol} (${marketData.market.loanAsset.address})`);
    }
    
    if (marketData.market.collateralAsset) {
      console.log(`Collateral Asset: ${marketData.market.collateralAsset.symbol} (${marketData.market.collateralAsset.address})`);
    }
    
    if (marketData.market.state) {
      // Format the values with decimals if available
      const formatAssetValue = (value, decimals) => {
        if (!value) return 'N/A';
        if (!decimals) return value;
        
        // Convert to decimal representation based on token decimals
        const numValue = parseFloat(value) / (10 ** decimals);
        return numValue.toLocaleString();
      };
      
      const loanDecimals = marketData.market.loanAsset?.decimals;
      console.log(`${supplyField}: ${formatAssetValue(marketData.market.state[supplyField], loanDecimals)} ${marketData.market.loanAsset?.symbol || ''}`);
      console.log(`${borrowField}: ${formatAssetValue(marketData.market.state[borrowField], loanDecimals)} ${marketData.market.loanAsset?.symbol || ''}`);
    } else {
      console.log('No state data found for this market.');
    }
    
    return marketData;
  } catch (error) {
    console.error('Error fetching market data:', error);
    throw error;
  }
}

// Main function to orchestrate the queries
async function main() {
  try {
    const marketFields = await getMarketSchema();
    const marketStateFields = await getMarketStateSchema();
    await getMarketData(marketFields, marketStateFields);
    console.log('\nQuery completed successfully');
  } catch (error) {
    console.log('\nQuery failed:', error.message);
  }
}

// Execute the main function
main(); 