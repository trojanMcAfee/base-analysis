import { ethers } from 'ethers'; // Ethers v6: No BigNumber import
import {
    // MORPHO_CONTRACT_ADDRESS, // No longer needed here
    USDC_BASE_ADDRESS,
    cbBTC_BASE_ADDRESS,
    cbBTC_USDC_ORACLE_ADDRESS,
    cbBTC_USDC_IRM_ADDRESS, // Need this for contract address
    LLTV, // This is already BigInt in common.js
    CBBTC_USDC_MARKET_ID
} from '../state/common.js';
import { fetchMarketDetails } from './supplyBorrowLiq2.js';
import { irmAbi } from '../state/abis.js'; // Import the new irmAbi
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.private
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.private') });

// Function to get Base RPC URL from environment variables
function getBaseRpcUrl() {
    const rpcUrl = process.env.BASE_RPC_URL;
    if (!rpcUrl) {
        console.error('Error: BASE_RPC_URL is not set in the environment variables (.env.private).');
        process.exit(1); // Exit if RPC URL is not configured
    }
    console.log(`Using Base RPC URL: ${rpcUrl.substring(0, 20)}...`); // Log part of the URL for verification
    return rpcUrl;
}

// ABI is now imported from abis.js
// const morphoAbi = [ ... ];

// Seconds per year for APY calculation
const SECONDS_PER_YEAR = 31536000n; // Ethers v6 uses native BigInt
const MAX_UINT128 = (2n ** 128n) - 1n; // Native BigInt calculation

// Main function to fetch market data and call borrowRateView
async function main() {
    try {
        // 1. Fetch market details from the subgraph
        console.log(`Fetching market details for ID: ${CBBTC_USDC_MARKET_ID}...`);
        const marketData = await fetchMarketDetails(CBBTC_USDC_MARKET_ID);

        if (!marketData || !marketData.market) {
            console.error('Failed to fetch market details from the subgraph.');
            return; // Exit if market data is not available
        }

        const marketState = marketData.market;
        console.log('Market details fetched successfully.');

        // 2. Set up Ethereum provider and contract instance (Ethers v6 syntax)
        const rpcUrl = getBaseRpcUrl();
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        // Use IRM address and imported ABI
        const irmContract = new ethers.Contract(cbBTC_USDC_IRM_ADDRESS, irmAbi, provider);
        console.log(`Connected to IRM contract at: ${cbBTC_USDC_IRM_ADDRESS}`);

        // 3. Prepare arguments for borrowRateView (Using native BigInt)
        const marketParams = {
            loanToken: USDC_BASE_ADDRESS,
            collateralToken: cbBTC_BASE_ADDRESS,
            oracle: cbBTC_USDC_ORACLE_ADDRESS,
            irm: cbBTC_USDC_IRM_ADDRESS, // Pass the IRM address itself here as well
            lltv: LLTV
        };

        // Convert and validate subgraph values against uint128 limits
        const marketValues = {
            totalSupplyAssets: BigInt(marketState.totalSupply),
            totalSupplyShares: BigInt(marketState.totalSupplyShares),
            totalBorrowAssets: BigInt(marketState.totalBorrow),
            totalBorrowShares: BigInt(marketState.totalBorrowShares),
            lastUpdate: BigInt(marketState.lastUpdate),
            fee: 0n
        };

        for (const [key, value] of Object.entries(marketValues)) {
            if (value < 0n || value > MAX_UINT128) { // Use native BigInt comparison
                console.error(
                    `Error: Value for '${key}' (${value.toString()}) ` +
                    `fetched from subgraph exceeds uint128 limits (0 to ${MAX_UINT128.toString()}).`
                );
                return; // Exit if any value is out of bounds
            }
        }

        console.log('All market state values are within uint128 limits.');

        // Use the actual market values again
        const market = {
            totalSupplyAssets: marketValues.totalSupplyAssets,
            totalSupplyShares: marketValues.totalSupplyShares,
            totalBorrowAssets: marketValues.totalBorrowAssets,
            totalBorrowShares: marketValues.totalBorrowShares,
            lastUpdate: marketValues.lastUpdate,
            fee: marketValues.fee
        };

        // Explicitly log the structures before the call
        console.log('\n--- Preparing Contract Call ---');
        console.log('Target Contract (IRM): ', cbBTC_USDC_IRM_ADDRESS);
        console.log('Market Params:', {
            loanToken: marketParams.loanToken,
            collateralToken: marketParams.collateralToken,
            oracle: marketParams.oracle,
            irm: marketParams.irm,
            lltv: marketParams.lltv.toString() // Log LLTV as string
        });
        console.log('Market Struct:', {
            totalSupplyAssets: market.totalSupplyAssets.toString(),
            totalSupplyShares: market.totalSupplyShares.toString(),
            totalBorrowAssets: market.totalBorrowAssets.toString(),
            totalBorrowShares: market.totalBorrowShares.toString(),
            lastUpdate: market.lastUpdate.toString(),
            fee: market.fee.toString()
        });
        console.log('-----------------------------');

        console.log('Calling borrowRateView...');

        // 4. Call the borrowRateView function on the IRM contract
        const borrowRatePerSecond = await irmContract.borrowRateView(marketParams, market);
        console.log(`Raw Borrow Rate (per second, 18 decimals): ${borrowRatePerSecond.toString()}`);

        // 5. Calculate and format APY (Using native BigInt and ethers.formatUnits)
        const borrowApy = (borrowRatePerSecond * SECONDS_PER_YEAR);

        // Format as percentage (divide by 1e18)
        const borrowApyFormatted = ethers.formatUnits(borrowApy, 18); // APY is also 18 decimals
        const borrowApyPercent = parseFloat(borrowApyFormatted) * 100;

        console.log('------------------------------------------');
        console.log(`Calculated Borrow APY: ${borrowApyPercent.toFixed(4)}%`);
        console.log('------------------------------------------');

    } catch (error) {
        console.error('\nAn error occurred:', error);
        // Check for revert data in Ethers v6 style
        if (error.data) {
            console.error('Revert data:', error.data);
        } else if (error.info?.error?.data) { // Ethers v6 often wraps details here
            console.error('Revert data (nested): ', error.info.error.data);
        }
    }
}

// Execute the main function if this file is run directly
if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
 