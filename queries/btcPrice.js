import Web3 from 'web3';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

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

// RedStone Oracle Interface ABI (minimal for price feed)
const oracleABI = [
  {
    "inputs": [],
    "name": "latestRoundData",
    "outputs": [
      {
        "internalType": "uint80",
        "name": "roundId",
        "type": "uint80"
      },
      {
        "internalType": "int256",
        "name": "answer",
        "type": "int256"
      },
      {
        "internalType": "uint256",
        "name": "startedAt",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "updatedAt",
        "type": "uint256"
      },
      {
        "internalType": "uint80",
        "name": "answeredInRound",
        "type": "uint80"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// RedStone BTC/USD Price Feed address on Ink
const REDSTONE_BTC_USD_FEED = '0x13433B1949d9141Be52Ae13Ad7e7E4911228414e';

// Main function to fetch the BTC/USD price
export async function fetchBTCPrice() {
  try {
    // Initialize Web3 with the Ink RPC URL
    const web3 = new Web3(process.env.INK_RPC_URL);
    
    // Create a contract instance
    const oracle = new web3.eth.Contract(oracleABI, REDSTONE_BTC_USD_FEED);
    
    // Get the number of decimals
    const decimals = await oracle.methods.decimals().call();
    
    // Get the latest price data
    const { roundId, answer, startedAt, updatedAt, answeredInRound } = await oracle.methods.latestRoundData().call();
    
    // Convert BigInt to string first, then to number, and handle large numbers safely
    const answerString = answer.toString();
    const decimalString = decimals.toString();
    
    // Calculate the actual price by adjusting for decimals
    // Use safer approach for calculating with large numbers
    const decimalValue = parseInt(decimalString);
    const divisor = BigInt(10) ** BigInt(decimalValue);
    const price = Number(BigInt(answerString) * BigInt(100) / divisor) / 100;
    
    // Format the output
    console.log(`BTC/USD Price: $${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`Last Updated: ${new Date(Number(updatedAt.toString()) * 1000).toISOString()}`);
    
    return { price, updatedAt: Number(updatedAt.toString()) };
  } catch (error) {
    console.error('Error fetching BTC/USD price:', error.message);
    throw error;
  }
}

// Only execute when run directly, not when imported
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchBTCPrice()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Script execution failed:', error);
      process.exit(1);
    });
} 