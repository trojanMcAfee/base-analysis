import axios from 'axios';
import {
  MORPHO_GRAPHQL_ENDPOINT,
  GRAPHQL_MARKET_ID,
  CBBTC_USDC_MARKET_ID,
  BASE_CHAIN_ID
} from './state/common.js';

// Define the GraphQL query
const marketDailyBorrowApyQuery = `
  query MarketDailyBorrowApy($uniqueKey: String!, $chainId: Int!, $options: TimeseriesOptions) {
    marketByUniqueKey(
      uniqueKey: $uniqueKey,
      chainId: $chainId
    ) {
      uniqueKey
      historicalState {
        borrowApy(options: $options) {
          x
          y
        }
      }
    }
  }
`;

// Define the options for the query
const queryOptions = {
  startTimestamp: 1708354500, 
  endTimestamp: 1744210936,  
  interval: "DAY"
};

// Function to fetch data
async function fetchMarketDailyBorrowApy() {
  try {
    const response = await axios.post(MORPHO_GRAPHQL_ENDPOINT, {
      query: marketDailyBorrowApyQuery,
      variables: {
        uniqueKey: CBBTC_USDC_MARKET_ID,
        chainId: BASE_CHAIN_ID,
        options: queryOptions
      }
    });

    if (response.data.errors) {
      console.error("GraphQL Errors:", response.data.errors);
      return;
    }

    const marketData = response.data?.data?.marketByUniqueKey;
    if (marketData && marketData.historicalState.borrowApy.length > 0) {
      const borrowApyData = marketData.historicalState.borrowApy;
      
      // Calculate the average APY
      const sumApy = borrowApyData.reduce((sum, dataPoint) => sum + dataPoint.y, 0);
      const averageApy = sumApy / borrowApyData.length;

      console.log("Average Daily Borrow APY:", `${(averageApy * 100).toFixed(2)}%`);
    } else if (marketData && marketData.historicalState.borrowApy.length === 0) {
       console.log("No historical borrow APY data found for the specified period.");
    } else {
      console.log("No data found for the specified market.");
    }

  } catch (error) {
    console.error("Error fetching data:", error.message);
    if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);
        console.error("Response headers:", error.response.headers);
    } else if (error.request) {
        // The request was made but no response was received
        console.error("Request data:", error.request);
    } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error', error.message);
    }
  }
}

// Execute the function
fetchMarketDailyBorrowApy(); 