import { Web3 } from 'web3';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchMarketById } from './supplyBorrowLiq.js';
import { morphoABI, chainlinkOracleABI } from './state/abis.js';
import { 
  BORROWED_AMOUNT_DECIMALS, 
  ORACLE_PRICE_DECIMALS, 
  COLLATERAL_AMOUNT_DECIMALS,
  MORPHO_CONTRACT_ADDRESS,
  CHAINLINK_ORACLE_ADDRESS,
  CBBTC_USDC_MARKET_ID,
  USER_ADDRESS,
  BLOCK_NUMBER,
  GRAPHQL_MARKET_ID,
  calculateBorrowedAmount
} from './state/common.js';

// Configure environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Also load from .env.private which contains THE_GRAPH_API_KEY
dotenv.config({ path: path.resolve(__dirname, '../.env.private') });

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

// Function to query the position and calculate LTV
async function calculateLTV() {
  try {
    // Create contract instances
    const morphoContract = new web3.eth.Contract(morphoABI, MORPHO_CONTRACT_ADDRESS);
    const oracleContract = new web3.eth.Contract(chainlinkOracleABI, CHAINLINK_ORACLE_ADDRESS);
    
    // Call the position function at the specified block
    const position = await morphoContract.methods.position(CBBTC_USDC_MARKET_ID, USER_ADDRESS).call({}, BLOCK_NUMBER);
    
    // Call the oracle to get the latest price data
    const oracleData = await oracleContract.methods.latestRoundData().call({}, BLOCK_NUMBER);
    const oraclePrice = BigInt(oracleData.answer.toString());
    
    console.log('Position data for user at block', BLOCK_NUMBER, ':');
    console.log('------------------------------------------');
    console.log('Market ID:', CBBTC_USDC_MARKET_ID);
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
      
      // Convert values to decimal for calculation
      const borrowedDecimal = Number(borrowedAmount) / Number(BORROWED_AMOUNT_DECIMALS);
      const oraclePriceDecimal = Number(oraclePrice) / Number(ORACLE_PRICE_DECIMALS);
      const collateralDecimal = Number(position.collateral) / Number(COLLATERAL_AMOUNT_DECIMALS);
      
      // Calculate collateral value in USD
      const collateralValueUSD = collateralDecimal * oraclePriceDecimal;
      
      // Calculate LTV as borrowedAmount / collateralValueUSD * 100
      const ltv = (borrowedDecimal / collateralValueUSD) * 100;
      
      console.log('\nLTV Calculation:');
      console.log('------------------------------------------');
      console.log('BORROWED_AMOUNT:', borrowedDecimal.toFixed(6), 'USDC');
      console.log('ORACLE_PRICE:', oraclePriceDecimal.toFixed(6), 'USD per BTC');
      console.log('COLLATERAL_AMOUNT:', collateralDecimal.toFixed(8), 'BTC');
      console.log('COLLATERAL_VALUE_USD:', collateralValueUSD.toFixed(6), 'USD');
      console.log('------------------------------------------');
      console.log('LTV Formula: (BORROWED_AMOUNT / COLLATERAL_VALUE_USD) * 100');
      console.log('------------------------------------------');
      console.log('LTV (percentage):', formatLTVAsPercentage(ltv));
      
      return ltv;
    } else {
      console.log('\nNo market data found with the provided ID');
      return null;
    }
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

// Execute the function only if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  calculateLTV();
}

// Export functions and format utility
export { calculateLTV, formatLTVAsPercentage }; 
