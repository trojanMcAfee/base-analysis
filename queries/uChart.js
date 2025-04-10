import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { cbBTC_USDC_IRM_ADDRESS, CBBTC_USDC_MARKET_ID } from './state/common.js';

dotenv.config({ path: '../.env.private' }); // Adjust path if necessary

const SECONDS_PER_YEAR = 31536000;
const TARGET_UTILIZATION = 90; // The utilization percent where rateAtTarget applies

// ABI for the rateAtTarget function
const irmAbi = [
    'function rateAtTarget(bytes32 id) external view returns (int256)'
];

async function main() {
    const providerUrl = process.env.BASE_RPC_URL;
    if (!providerUrl) {
        console.error('Error: BASE_RPC_URL environment variable not set.');
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(providerUrl);
    const irmContract = new ethers.Contract(cbBTC_USDC_IRM_ADDRESS, irmAbi, provider);

    try {
        // 1 & 2: Get the rate at target utilization (90%)
        const borrowRateBigInt = await irmContract.rateAtTarget(CBBTC_USDC_MARKET_ID);

        // Convert the rate (assuming 1e18 decimals as per formula) to a number for APR calculation
        // Note: The actual rate returned by Morpho IRMs is usually in Ray (1e27). 
        // If the formula expected Ray, the divisor should be 1e27.
        // Using 1e18 as specified in the user request.
        const borrowRateNumber = parseFloat(ethers.formatUnits(borrowRateBigInt, 18)); 

        // Calculate APR (N) at 90% utilization
        const aprAtTarget = (Math.exp(borrowRateNumber * SECONDS_PER_YEAR) - 1) * 100;
        console.log(`1- At Utilization ${TARGET_UTILIZATION}%, the rate (N) is: ${aprAtTarget.toFixed(4)}%`);

        // 3: Calculate rate at 0% utilization
        const aprAtZero = aprAtTarget / 4;
        console.log(`   At Utilization 0%, the rate is: ${aprAtZero.toFixed(4)}%`);

        // 4: Calculate rate at 100% utilization
        const aprAtHundred = aprAtTarget * 4;
        console.log(`   At Utilization 100%, the rate is: ${aprAtHundred.toFixed(4)}%`);

        console.log('\nCalculating rates from 1% to 100% utilization:');

        // Points for piecewise linear interpolation
        const pointZero = { u: 0, rate: aprAtZero };
        const pointTarget = { u: TARGET_UTILIZATION, rate: aprAtTarget };
        const pointHundred = { u: 100, rate: aprAtHundred };

        for (let u = 1; u <= 100; u++) {
            let currentApr;
            if (u <= TARGET_UTILIZATION) {
                // Linear interpolation between 0% and TARGET_UTILIZATION%
                currentApr = pointZero.rate + (pointTarget.rate - pointZero.rate) * (u - pointZero.u) / (pointTarget.u - pointZero.u);
            } else {
                // Linear interpolation between TARGET_UTILIZATION% and 100%
                currentApr = pointTarget.rate + (pointHundred.rate - pointTarget.rate) * (u - pointTarget.u) / (pointHundred.u - pointTarget.u);
            }
            console.log(`   Utilization: ${u}%, Rate: ${currentApr.toFixed(4)}%`);
        }

    } catch (error) {
        console.error('Error fetching or calculating rates:', error);
    }
}

main(); 