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

// Check if ALCHEMY_RPC_URL is defined
if (!process.env.ALCHEMY_RPC_URL) {
  console.error('ALCHEMY_RPC_URL is not defined in the .env.private file');
  process.exit(1);
}

// Initialize Web3 with Alchemy RPC URL
const web3 = new Web3(process.env.ALCHEMY_RPC_URL);

// Function to format LTV as a percentage with higher precision
function formatLTVAsPercentage(ltv) {
  return ltv.toFixed(2) + '%';
}

// Helper function to format BigInt values (similar to supplyBorrowLiq)
const formatBigIntUnits = (value, decimals) => {
    if (typeof value !== 'bigint') {
        try {
            value = BigInt(value || '0');
        } catch (e) { value = 0n; }
    }
    if (value === 0n) return '0.00';

    let str = value.toString();
    const isNegative = str.startsWith('-');
    if (isNegative) str = str.slice(1);

    const len = str.length;
    let intPart, decPart;

    if (len <= decimals) {
        intPart = '0';
        decPart = '0'.repeat(decimals - len) + str;
    } else {
        intPart = str.slice(0, len - decimals);
        decPart = str.slice(len - decimals);
    }
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    decPart = (decPart || '0').padEnd(2, '0');
    return (isNegative ? '-' : '') + intPart + '.' + decPart;
};

// Function to query the position and calculate LTV
async function calculateLTV() {
  let web3Position, oracleData, marketData;
  
  try {
    console.log(`Fetching data for LTV calculation at block ${BLOCK_NUMBER}...`);
    const morphoContract = new web3.eth.Contract(morphoABI, MORPHO_CONTRACT_ADDRESS);
    const oracleContract = new web3.eth.Contract(chainlinkOracleABI, CHAINLINK_ORACLE_ADDRESS);
    
    // Fetch data concurrently
    [web3Position, oracleData, marketData] = await Promise.all([
      morphoContract.methods.position(CBBTC_USDC_MARKET_ID, USER_ADDRESS).call({}, BLOCK_NUMBER),
      oracleContract.methods.latestRoundData().call({}, BLOCK_NUMBER),
      fetchMarketById(CBBTC_USDC_MARKET_ID) // Fetch market data using the imported function
    ]);

    // --- Validation --- 
    if (!web3Position) {
      throw new Error('Failed to fetch Web3 position data.');
    }
    if (!oracleData || !oracleData.answer) {
      throw new Error('Failed to fetch Oracle data or answer field missing.');
    }
    if (!marketData || !marketData.market) {
      // fetchMarketById logs its own errors, so just throw here
      throw new Error(`Failed to fetch market data for ID ${CBBTC_USDC_MARKET_ID} from GraphQL.`);
    }
    // Check required market fields explicitly
    if (marketData.market.totalBorrow === undefined || marketData.market.totalBorrowShares === undefined) {
        throw new Error('Market data from GraphQL is missing required fields (totalBorrow or totalBorrowShares).');
    }

    // --- Data Processing --- 
    const market = marketData.market;
    const oraclePriceRaw = BigInt(oracleData.answer); // Oracle price (e.g., BTC/USD with 8 decimals)
    const positionCollateralRaw = BigInt(web3Position.collateral); // User's collateral (cbBTC with 8 decimals)
    const positionBorrowShares = BigInt(web3Position.borrowShares); // User's borrow shares
    const marketTotalBorrowRaw = BigInt(market.totalBorrow); // Market total borrow (USDC with 6 decimals)
    const marketTotalBorrowShares = BigInt(market.totalBorrowShares); // Market total borrow shares

    // Get decimals from fetched data, provide defaults
    const collateralDecimals = market.inputToken?.decimals ?? 8; // Default cbBTC decimals
    const loanDecimals = market.borrowedToken?.decimals ?? 6; // Default USDC decimals
    const oraclePriceDecimals = 8; // Chainlink BTC/USD oracle typically uses 8 decimals

    console.log('\n--- Raw Data ---');
    console.log('------------------------------------------');
    console.log('Market ID:', CBBTC_USDC_MARKET_ID);
    console.log('User Address:', USER_ADDRESS);
    console.log(`Collateral (Raw): ${positionCollateralRaw.toString()} (${collateralDecimals} decimals)`);
    console.log(`Borrow Shares: ${positionBorrowShares.toString()}`);
    console.log(`Oracle Price (Raw): ${oraclePriceRaw.toString()} (${oraclePriceDecimals} decimals)`);
    console.log(`Market Total Borrow (Raw): ${marketTotalBorrowRaw.toString()} (${loanDecimals} decimals)`);
    console.log(`Market Total Borrow Shares (Raw): ${marketTotalBorrowShares.toString()}`);
    console.log('------------------------------------------');

    // --- Calculations --- 
    
    // Calculate borrowed amount in loan asset's smallest unit (e.g., USDC wei)
    const borrowedAmountRaw = calculateBorrowedAmount(
      positionBorrowShares, 
      marketTotalBorrowRaw, 
      marketTotalBorrowShares
    );

    // If collateral or price is zero, LTV is infinite or zero depending on borrow
    if (positionCollateralRaw === 0n || oraclePriceRaw === 0n) {
        console.log('\nCollateral amount or Oracle price is zero.');
        const ltv = (borrowedAmountRaw > 0n) ? Infinity : 0;
        console.log(`LTV: ${ltv === Infinity ? 'Infinite' : '0.00%'}`);
        return ltv; 
    }

    // Calculate Collateral Value in USD (maintaining precision with BigInt)
    // (collateralRaw * oraclePriceRaw) / 10^collateralDecimals
    // We divide by 10^collateralDecimals because oracle price is $/collateral_unit
    const collateralValueUsdRaw = (positionCollateralRaw * oraclePriceRaw) / (10n ** BigInt(collateralDecimals));
    // This value has oraclePriceDecimals (8) + loanDecimals (6) - collateralDecimals (8) = 6 decimals effectively (representing USDC wei)

    // Calculate LTV using BigInt math for precision before converting to percentage
    // LTV = (borrowedAmountRaw * 10^(oraclePriceDecimals)) / collateralValueUsdRaw
    // Multiply borrow by 10^oraclePriceDecimals to align decimals before division
    // Result needs scaling by 100 for percentage

    // To prevent overflow and maintain precision, scale borrow amount first
    // We want (borrowed / 10^loanDec) / (collateralValueUsdRaw / 10^oracleDec)
    // = (borrowed * 10^oracleDec) / (collateralValueUsd * 10^loanDec)
    // Let's use floating point for the final percentage calculation for simplicity, 
    // after getting high-precision raw values.

    const borrowedDecimal = Number(borrowedAmountRaw) / (10 ** loanDecimals); 
    const collateralValueUSDDecimal = Number(collateralValueUsdRaw) / (10 ** oraclePriceDecimals); // Convert USD value to float

    if (collateralValueUSDDecimal === 0) {
        console.log('\nCalculated Collateral Value in USD is zero.');
        const ltv = (borrowedDecimal > 0) ? Infinity : 0;
        console.log(`LTV: ${ltv === Infinity ? 'Infinite' : '0.00%'}`);
        return ltv; 
    }
    
    const ltv = (borrowedDecimal / collateralValueUSDDecimal) * 100;
    
    console.log('\n--- LTV Calculation ---');
    console.log('------------------------------------------');
    console.log(`BORROWED_AMOUNT (Raw): ${borrowedAmountRaw.toString()} (USDC wei)`);
    console.log(`BORROWED_AMOUNT (Formatted): ${formatBigIntUnits(borrowedAmountRaw, loanDecimals)} USDC`);
    console.log(`COLLATERAL_VALUE_USD (Raw): ${collateralValueUsdRaw.toString()} (Scaled USD)`);
    console.log(`COLLATERAL_VALUE_USD (Formatted): $${formatBigIntUnits(collateralValueUsdRaw, oraclePriceDecimals)}`); 
    console.log('------------------------------------------');
    console.log('LTV Formula: (Borrowed Amount / Collateral Value USD) * 100');
    console.log(`LTV Calculation: (${borrowedDecimal.toFixed(6)} / ${collateralValueUSDDecimal.toFixed(6)}) * 100`);
    console.log('------------------------------------------');
    console.log('LTV (percentage):', formatLTVAsPercentage(ltv));
    console.log('------------------------------------------');
    
    return ltv;

  } catch (error) {
    // Log the specific error that occurred
    console.error('\n--- ERROR ---');
    console.error('Error during LTV calculation:', error.message);
    console.error('-------------');
    // Exit the script on failure
    process.exit(1); 
  }
}

// Execute the function only if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  calculateLTV();
}

// Export functions and format utility
export { calculateLTV, formatLTVAsPercentage }; 
