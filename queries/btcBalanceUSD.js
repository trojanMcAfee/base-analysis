import { fetchBTCPrice } from './btcPrice.js';
import Web3 from 'web3';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { DEFAULT_BTC_BALANCE } from './state/variables.js';

// Get the current module's directory and construct the path to the .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');

// Load environment variables from the .env file
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.error('.env file not found');
  process.exit(1);
}

/**
 * Query the BTC balance of a given address
 * @param {string} address - The Bitcoin address to query
 * @returns {Promise<number>} - The balance in BTC
 */
async function queryBTCBalance(address) {
  try {
    if (!address) {
      console.log('No address provided, using default balance of 0.2 BTC');
      return DEFAULT_BTC_BALANCE;
    }

    // Initialize Web3 with the RPC URL
    new Web3(process.env.INK_RPC_URL);
    
    // This is where you would implement the actual balance query logic
    // For a real implementation, you might:
    // 1. Call a Bitcoin API/node to get the balance
    // 2. Use a specific library for Bitcoin
    // 3. Use a service/API that provides Bitcoin address balances
    
    console.log(`Querying balance for address: ${address}`);
    
    // Placeholder for the actual implementation
    // In a real scenario, you would remove this and implement the actual query
    console.log('Note: This is a placeholder implementation. Actual balance querying is not implemented.');
    
    // For demonstration, return the default balance
    return DEFAULT_BTC_BALANCE;
  } catch (error) {
    console.error(`Error querying balance for address ${address}:`, error.message);
    console.log('Using default balance of 0.2 BTC instead');
    return DEFAULT_BTC_BALANCE;
  }
}

/**
 * Calculate the USD value of a BTC balance
 * @param {string} address - Optional Bitcoin address to query the balance for
 * @returns {Promise<Object>} - Object containing the BTC balance, price, USD value, and timestamp
 */
async function calculateUSDValue(address) {
  try {
    // Query the BTC balance for the given address, or use default
    const btcBalance = await queryBTCBalance(address);
    
    // Fetch the current BTC/USD price
    const { price, updatedAt } = await fetchBTCPrice();
    
    // Calculate the USD value
    const usdValue = btcBalance * price;
    
    // Format the output
    console.log(`USD Value: $${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    
    return { btcBalance, price, usdValue, updatedAt };
  } catch (error) {
    console.error('Error calculating USD value:', error.message);
    throw error;
  }
}

// Get the address from command line arguments, if provided
const address = process.argv[2];

// Execute the main function with the address (or undefined if not provided)
calculateUSDValue(address)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Script execution failed:', error);
    process.exit(1);
  }); 