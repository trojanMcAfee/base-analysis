import { Web3 } from 'web3';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Configure environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Check if BASE_RPC_URL is defined
if (!process.env.BASE_RPC_URL) {
  console.error('BASE_RPC_URL is not defined in the .env file');
  process.exit(1);
}

// Initialize Web3 with Base RPC URL
const web3 = new Web3(process.env.BASE_RPC_URL);

// Morpho contract ABI (minimal version for the position function)
const morphoABI = [
  {
    "inputs": [
      {
        "internalType": "Id",
        "name": "id",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "position",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "supplyShares",
        "type": "uint256"
      },
      {
        "internalType": "uint128",
        "name": "borrowShares",
        "type": "uint128"
      },
      {
        "internalType": "uint128",
        "name": "collateral",
        "type": "uint128"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Morpho contract address
const MORPHO_CONTRACT_ADDRESS = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb';

// Function parameters
const MARKET_ID = '0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65cb2f4edaf1380ba1bda'; // WETH/USDC market
const USER_ADDRESS = '0xc10f94115d1dc2D042B88b3Cc86D34380C55CEf5';
const BLOCK_NUMBER = 27849529;

// Function to query the position
async function queryPosition() {
  try {
    // Create contract instance
    const morphoContract = new web3.eth.Contract(morphoABI, MORPHO_CONTRACT_ADDRESS);
    
    // Call the position function at the specified block
    const position = await morphoContract.methods.position(MARKET_ID, USER_ADDRESS).call({}, BLOCK_NUMBER);
    
    console.log('Position data for user at block', BLOCK_NUMBER, ':');
    console.log('------------------------------------------');
    console.log('Market ID:', MARKET_ID);
    console.log('User Address:', USER_ADDRESS);
    console.log('------------------------------------------');
    console.log('Supply Shares:', position.supplyShares.toString());
    console.log('Borrow Shares:', position.borrowShares.toString());
    console.log('Collateral:', position.collateral.toString());
    
  } catch (error) {
    console.error('Error querying position:', error.message);
  }
}

// Execute the function
queryPosition(); 