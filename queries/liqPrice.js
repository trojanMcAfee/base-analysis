import { Web3 } from 'web3';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchMarketById } from './supplyBorrowLiq.js';
import { morphoABI } from './state/abis.js';
import { 
  BORROWED_AMOUNT_DECIMALS, 
  COLLATERAL_AMOUNT_DECIMALS,
  MORPHO_CONTRACT_ADDRESS,
  CBBTC_USDC_MARKET_ID,
  USER_ADDRESS,
  BLOCK_NUMBER,
  calculateBorrowedAmount,
  parseLLTVToDecimal
} from './state/common.js';

// Configure environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Also load from .env.private which contains THE_GRAPH_API_KEY
dotenv.config({ path: path.resolve(__dirname, '../.env.private') });

// Check if ALCHEMY_RPC_URL is defined
if (!process.env.ALCHEMY_RPC_URL) {
  console.error('ALCHEMY_RPC_URL is not defined in the .env.private file');
  process.exit(1);
}

// Initialize Web3 with Alchemy RPC URL
const web3 = new Web3(process.env.ALCHEMY_RPC_URL);

// Function to calculate liquidation price
async function calculateLiquidationPrice() {
  try {
    // Create Morpho contract instance
    const morphoContract = new web3.eth.Contract(morphoABI, MORPHO_CONTRACT_ADDRESS);
    
    // Call the position function at the specified block
    const position = await morphoContract.methods.position(CBBTC_USDC_MARKET_ID, USER_ADDRESS).call({}, BLOCK_NUMBER);
    
    console.log('Position data for user at block', BLOCK_NUMBER, ':');
    console.log('------------------------------------------');
    console.log('Market ID:', CBBTC_USDC_MARKET_ID);
    console.log('User Address:', USER_ADDRESS);
    
    // Fetch market data from GraphQL
    console.log('\nFetching market data from GraphQL...');
    const marketData = await fetchMarketById(CBBTC_USDC_MARKET_ID);
    
    if (marketData && marketData.market) {
      const market = marketData.market;
      
      // Calculate borrowed amount using the provided formula
      const borrowedAmount = calculateBorrowedAmount(
        position.borrowShares,
        market.totalBorrow,
        market.totalBorrowShares
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