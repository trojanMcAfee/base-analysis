import { Web3 } from 'web3';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchMarketById } from './supplyBorrowLiq.js';

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

// Constants for calculations
const VIRTUAL_SHARES = BigInt(1e6);
const VIRTUAL_ASSETS = BigInt(1);

// Asset decimal adjustment factors
const BORROWED_AMOUNT_DECIMALS = BigInt(10) ** BigInt(6); // 1e6
const COLLATERAL_AMOUNT_DECIMALS = BigInt(10) ** BigInt(8); // 1e8

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

// Contract addresses
const MORPHO_CONTRACT_ADDRESS = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb';

// Function parameters
const MARKET_ID = '0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836'; // cbBTC/USDC market
const USER_ADDRESS = '0xc10f94115d1dc2D042B88b3Cc86D34380C55CEf5';
const BLOCK_NUMBER = 27884440;
// Morpho GraphQL market ID
const GRAPHQL_MARKET_ID = 'f6bdf547-ff28-429b-b81d-d98574a6fbcd';

// Utility functions for big number math
function mulDivUp(x, y, d) {
  // (x * y + (d - 1)) / d
  const numerator = (x * y) + (d - BigInt(1));
  return numerator / d;
}

function toAssetsUp(shares, totalAssets, totalShares) {
  return mulDivUp(
    shares,
    totalAssets + VIRTUAL_ASSETS,
    totalShares + VIRTUAL_SHARES
  );
}

// Function to calculate borrowed amount
function calculateBorrowedAmount(borrowShares, totalBorrowAssets, totalBorrowShares) {
  // Convert all values to BigInt for accurate calculation
  const shares = BigInt(borrowShares.toString());
  const assets = BigInt(totalBorrowAssets.toString());
  const totalShares = BigInt(totalBorrowShares.toString());
  
  // Calculate borrowed amount using toAssetsUp function
  return toAssetsUp(shares, assets, totalShares);
}

// Function to parse LLTV from string to decimal
function parseLLTVToDecimal(lltvValue) {
  // The LLTV is stored as a fixed-point number with 18 decimals
  return parseFloat(lltvValue) / 1e18;
}

// Function to calculate liquidation price
async function calculateLiquidationPrice() {
  try {
    // Create Morpho contract instance
    const morphoContract = new web3.eth.Contract(morphoABI, MORPHO_CONTRACT_ADDRESS);
    
    // Call the position function at the specified block
    const position = await morphoContract.methods.position(MARKET_ID, USER_ADDRESS).call({}, BLOCK_NUMBER);
    
    console.log('Position data for user at block', BLOCK_NUMBER, ':');
    console.log('------------------------------------------');
    console.log('Market ID:', MARKET_ID);
    console.log('User Address:', USER_ADDRESS);
    
    // Fetch market data from GraphQL
    console.log('\nFetching market data from GraphQL...');
    const marketData = await fetchMarketById(GRAPHQL_MARKET_ID);
    
    if (marketData.market && marketData.market.state) {
      const market = marketData.market;
      
      // Calculate borrowed amount using the provided formula
      const borrowedAmount = calculateBorrowedAmount(
        position.borrowShares,
        market.state.borrowAssets,
        market.state.borrowShares
      );
      
      // Convert borrowed amount to decimal
      const borrowedDecimal = Number(borrowedAmount) / Number(BORROWED_AMOUNT_DECIMALS);
      
      // Calculate collateral in units (not USD)
      const collateralUnits = Number(position.collateral) / Number(COLLATERAL_AMOUNT_DECIMALS);
      
      // Get LLTV from the market data and convert to decimal (e.g., 0.86 instead of 86%)
      const lltvDecimal = parseLLTVToDecimal(market.lltv);
      
      // Calculate liquidation price using the formula:
      // Liquidation price = borrowed_assets / (collateral_units * lltv_decimals)
      const liquidationPrice = borrowedDecimal / (collateralUnits * lltvDecimal);
      
      console.log('\nLiquidation Price Calculation:');
      console.log('------------------------------------------');
      console.log('BORROWED_AMOUNT:', borrowedDecimal.toFixed(6), 'USDC');
      console.log('COLLATERAL_AMOUNT:', collateralUnits.toFixed(8), 'BTC');
      console.log('LLTV (decimal):', lltvDecimal.toFixed(4));
      console.log('------------------------------------------');
      console.log('Liquidation Price Formula: BORROWED_AMOUNT / (COLLATERAL_AMOUNT * LLTV)');
      console.log('------------------------------------------');
      console.log('Liquidation Price:', liquidationPrice.toFixed(2), 'USD per BTC');
      
    } else {
      console.log('\nNo market data found with the provided ID');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Execute the function
calculateLiquidationPrice(); 