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
const ORACLE_PRICE_SCALE = BigInt(10) ** BigInt(36); // 1e36

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

// Chainlink Oracle ABI for latestRoundData
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
  }
];

// Contract addresses
const MORPHO_CONTRACT_ADDRESS = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb';
const ORACLE_ADDRESS = '0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F';

// Function parameters
const MARKET_ID = '0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836'; // cbBTC/USDC market
const USER_ADDRESS = '0xc10f94115d1dc2D042B88b3Cc86D34380C55CEf5';
const BLOCK_NUMBER = 27851201;
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

// Function to calculate LTV
function calculateLTV(borrowedAmount, collateralAmount, oraclePrice, oraclePriceScale) {
  // LTV = (BORROWED_AMOUNT * ORACLE_PRICE) / (COLLATERAL_AMOUNT * ORACLE_PRICE_SCALE)
  const numerator = borrowedAmount * oraclePrice;
  const denominator = collateralAmount * oraclePriceScale;
  
  if (denominator === BigInt(0)) {
    return BigInt(0); // Avoid division by zero
  }
  
  return numerator / denominator;
}

// Function to format LTV as a percentage
function formatLTVAsPercentage(ltv) {
  // Convert the raw LTV ratio to a percentage with 2 decimal places
  const ltvFloat = Number(ltv) * 100;
  return ltvFloat.toFixed(2) + '%';
}

// Function to query the position and calculate LTV
async function calculateAndDisplayLTV() {
  try {
    // Create contract instances
    const morphoContract = new web3.eth.Contract(morphoABI, MORPHO_CONTRACT_ADDRESS);
    const oracleContract = new web3.eth.Contract(oracleABI, ORACLE_ADDRESS);
    
    // Call the position function at the specified block
    const position = await morphoContract.methods.position(MARKET_ID, USER_ADDRESS).call({}, BLOCK_NUMBER);
    
    // Call the oracle to get the latest price data
    const oracleData = await oracleContract.methods.latestRoundData().call({}, BLOCK_NUMBER);
    const oraclePrice = BigInt(oracleData.answer.toString());
    
    console.log('Position data for user at block', BLOCK_NUMBER, ':');
    console.log('------------------------------------------');
    console.log('Market ID:', MARKET_ID);
    console.log('User Address:', USER_ADDRESS);
    console.log('------------------------------------------');
    console.log('Supply Shares:', position.supplyShares.toString());
    console.log('Borrow Shares:', position.borrowShares.toString());
    console.log('Collateral:', position.collateral.toString());
    
    // Fetch market data from GraphQL
    console.log('\nFetching market data from GraphQL...');
    const marketData = await fetchMarketById(GRAPHQL_MARKET_ID);
    
    if (marketData.market && marketData.market.state) {
      const market = marketData.market;
      console.log('Market data fetched successfully');
      console.log('------------------------------------------');
      console.log('Total Borrow Assets:', market.state.borrowAssets);
      console.log('Total Borrow Shares:', market.state.borrowShares);
      
      // Calculate borrowed amount using the provided formula
      const borrowedAmount = calculateBorrowedAmount(
        position.borrowShares,
        market.state.borrowAssets,
        market.state.borrowShares
      );
      
      // Calculate LTV using all components
      const collateralAmount = BigInt(position.collateral.toString());
      const ltv = calculateLTV(borrowedAmount, collateralAmount, oraclePrice, ORACLE_PRICE_SCALE);
      
      console.log('\nLTV Calculation:');
      console.log('------------------------------------------');
      console.log('BORROWED_AMOUNT:', borrowedAmount.toString());
      console.log('ORACLE_PRICE:', oraclePrice.toString());
      console.log('COLLATERAL_AMOUNT:', collateralAmount.toString());
      console.log('ORACLE_PRICE_SCALE:', ORACLE_PRICE_SCALE.toString());
      console.log('------------------------------------------');
      console.log('LTV Formula:');
      console.log('LTV = (BORROWED_AMOUNT * ORACLE_PRICE) / (COLLATERAL_AMOUNT * ORACLE_PRICE_SCALE)');
      console.log('------------------------------------------');
      console.log('LTV (raw):', ltv.toString());
      console.log('LTV (percentage):', formatLTVAsPercentage(ltv));
      
    } else {
      console.log('\nNo market data found with the provided ID');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Execute the function
calculateAndDisplayLTV(); 