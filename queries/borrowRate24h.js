import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchBorrowingRate } from './borrowRateIm.js'; // Import the function
import { CBBTC_USDC_MARKET_ID, getBaseSubgraphEndpoint } from './state/common.js';

// Load environment variables from .env.private
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.private') });

// Function to make a direct GraphQL request (needed for fetching latest block)
async function makeGraphQLRequest(query, variables = {}) {
    try {
        const response = await fetch(getBaseSubgraphEndpoint(), {
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

// Function to get the latest block number from the subgraph
async function getLatestBlockNumber() {
    const query = `
    {
      _meta {
        block {
          number
        }
      }
    }
  `;
    const data = await makeGraphQLRequest(query);
    if (data && data._meta && data._meta.block) {
        return data._meta.block.number;
    } else {
        throw new Error('Could not fetch latest block number from subgraph.');
    }
}


// Main function to orchestrate the query
async function main() {
    try {
        console.log(`Calculating average 24h borrowing rate for cbBTC/USDC market...`);

        const latestBlock = await getLatestBlockNumber();
        console.log(`Latest block: ${latestBlock}`);

        const avgBlockTimeSeconds = 2; // Average block time for Base
        const secondsPerHour = 3600;
        const blocksPerHour = Math.round(secondsPerHour / avgBlockTimeSeconds);
        const hoursToGoBack = 24;

        let totalRate = 0;
        let ratesFound = 0;
        const hourlyRates = [];

        console.log(`Querying rates for the past ${hoursToGoBack} hours (approx. ${blocksPerHour} blocks/hour)...`);

        for (let i = 1; i <= hoursToGoBack; i++) {
            const targetBlock = latestBlock - (i * blocksPerHour);
            console.log(` -> Querying hour ${i} ago (block ~${targetBlock})...`); // Optional: Log each query

            try {
                const marketData = await fetchBorrowingRate(CBBTC_USDC_MARKET_ID, targetBlock);

                if (marketData.market && marketData.market.rates) {
                    const borrowRate = marketData.market.rates.find(
                        rate => rate.side === 'BORROWER' && rate.type === 'VARIABLE'
                    );

                    if (borrowRate) {
                        const ratePercentage = parseFloat(borrowRate.rate) * 100;
                        totalRate += ratePercentage;
                        ratesFound++;
                        hourlyRates.push({ hour: i, block: targetBlock, rate: ratePercentage.toFixed(4) });
                        console.log(`    Rate at block ${targetBlock}: ${ratePercentage.toFixed(4)}%`); // Optional: Log found rate
                    } else {
                        // console.log(`    No VARIABLE BORROWER rate found for block ${targetBlock}`); // Optional: Log missing rate
                        hourlyRates.push({ hour: i, block: targetBlock, rate: 'N/A' });
                    }
                } else {
                    // console.log(`    No market data found for block ${targetBlock}`); // Optional: Log missing market data
                     hourlyRates.push({ hour: i, block: targetBlock, rate: 'N/A (No market data)' });
                }
            } catch (error) {
                 console.warn(`  -> Warning: Could not fetch rate for block ${targetBlock}: ${error.message}`);
                 hourlyRates.push({ hour: i, block: targetBlock, rate: `Error (${error.message})` });
            }
             // Optional: Add a small delay to avoid overwhelming the subgraph endpoint
             await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Optional: Log all collected rates
        // console.log("\nCollected Hourly Rates (Past 24 Hours):");
        // hourlyRates.forEach(r => console.log(`Hour ${r.hour} ago (Block ~${r.block}): ${r.rate}`));

        if (ratesFound > 0) {
            const averageRate = totalRate / ratesFound;
            console.log(`\nAverage Borrow Rate (past 24h, ${ratesFound}/${hoursToGoBack} samples): ${averageRate.toFixed(4)}%`);
        } else {
            console.log('\nCould not calculate average rate. No valid borrow rates found in the last 24 hours.');
        }

    } catch (error) {
        console.error('Error calculating 24h average rate:', error);
        console.log('Query failed');
    }
}

// Execute the main function
main(); 