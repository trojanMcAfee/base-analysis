import { Web3 } from 'web3';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { morphoABI, chainlinkOracleABI } from './state/abis.js';
import { 
  ORACLE_PRICE_DECIMALS, 
  COLLATERAL_AMOUNT_DECIMALS,
  CHAINLINK_ORACLE_ADDRESS,
  BLOCK_NUMBER
} from './state/common.js';

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

// Function to format LTV as a percentage with higher precision
function formatLTVAsPercentage(ltv) {
  return ltv.toFixed(2) + '%';
}

// Function to format numbers with comma separators for thousands
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Function to calculate required collateral for a target LTV
async function calculateRequiredCollateral(borrowedAmount, targetLTV) {
  try {
    // Create oracle contract instance
    const oracleContract = new web3.eth.Contract(chainlinkOracleABI, CHAINLINK_ORACLE_ADDRESS);
    
    // Call the oracle to get the latest price data
    const oracleData = await oracleContract.methods.latestRoundData().call({}, BLOCK_NUMBER);
    const oraclePrice = BigInt(oracleData.answer.toString());
    const oraclePriceDecimal = Number(oraclePrice) / Number(ORACLE_PRICE_DECIMALS);
    
    console.log('\nPrice Data from Oracle:');
    console.log('------------------------------------------');
    console.log('BTC/USD Price:', formatNumber(oraclePriceDecimal.toFixed(2)), 'USD per BTC');
    
    // Calculate required collateral value in USD
    // LTV = borrowedAmount / collateralValueUSD * 100
    // So: collateralValueUSD = borrowedAmount / (targetLTV / 100)
    const collateralValueUSD = borrowedAmount / (targetLTV / 100);
    
    // Calculate required collateral in BTC
    // collateralValueUSD = collateralAmountBTC * btcPrice
    // So: collateralAmountBTC = collateralValueUSD / btcPrice
    const collateralAmountBTC = collateralValueUSD / oraclePriceDecimal;
    
    console.log('\nScenario for Target LTV:', formatLTVAsPercentage(targetLTV));
    console.log('------------------------------------------');
    console.log('BORROWED_AMOUNT:', borrowedAmount.toFixed(6), 'USDC');
    console.log('REQUIRED_COLLATERAL_VALUE_USD:', collateralValueUSD.toFixed(6), 'USD');
    console.log('REQUIRED_COLLATERAL_AMOUNT:', collateralAmountBTC.toFixed(8), 'cbBTC');
    console.log('------------------------------------------');
    console.log('Calculation Formula: REQUIRED_COLLATERAL_VALUE_USD = BORROWED_AMOUNT / (TARGET_LTV / 100)');
    console.log('Calculation Formula: REQUIRED_COLLATERAL_AMOUNT = REQUIRED_COLLATERAL_VALUE_USD / BTC_PRICE');
    
    return {
      borrowedAmount,
      targetLTV,
      collateralValueUSD,
      collateralAmountBTC,
      btcPrice: oraclePriceDecimal
    };
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

// Run the function with the scenarios requested
async function runExamples() {
  console.log('Calculating Required Collateral for Different LTV Scenarios');
  console.log('==========================================================');
  
  // Constants for our scenarios
  const BORROWED_AMOUNT = 10.009228;
  
  // Scenario 1: 40% LTV
  await calculateRequiredCollateral(BORROWED_AMOUNT, 40);
  
  console.log('\n==========================================================\n');
  
  // Scenario 2: 71.76% LTV
  await calculateRequiredCollateral(BORROWED_AMOUNT, 71.76);
}

// Execute the function only if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples();
}

// Export functions for external use
export { calculateRequiredCollateral, formatLTVAsPercentage }; 