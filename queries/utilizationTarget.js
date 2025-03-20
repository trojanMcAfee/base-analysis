import Web3 from 'web3';

// Morpho Blue contract address on Base
const MORPHO_ADDRESS = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb';

// Base chain ID
const BASE_CHAIN_ID = 8453;

// Known addresses for the assets we're interested in 
const CB_BTC_ADDRESS = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf'; // cbBTC on Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC on Base

// ABI for the market configuration function
const MORPHO_ABI = [
  {
    "inputs": [
      {
        "internalType": "Id",
        "name": "id",
        "type": "bytes32"
      }
    ],
    "name": "idToMarketParams",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "loanToken",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "collateralToken",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "oracle",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "irm",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "lltv",
            "type": "uint256"
          }
        ],
        "internalType": "struct MarketParams",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// ABI for the interest rate model's utilization target function
const IRM_ABI = [
  {
    "inputs": [],
    "name": "UTILIZATION_TARGET",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Function to fetch market configuration and utilization target from the smart contract
async function fetchUtilizationTarget(marketId) {
  try {
    // Connect to Base network using public RPC
    const web3 = new Web3('https://mainnet.base.org');
    
    // Create contract instance
    const morphoContract = new web3.eth.Contract(MORPHO_ABI, MORPHO_ADDRESS);
    
    // Fetch market parameters
    const marketParams = await morphoContract.methods.idToMarketParams(marketId).call();
    
    console.log('\nMarket Configuration:');
    console.log('--------------------');
    console.log(`Market ID: ${marketId}`);
    console.log(`Loan Token: ${marketParams.loanToken}`);
    console.log(`Collateral Token: ${marketParams.collateralToken}`);
    console.log(`Oracle: ${marketParams.oracle}`);
    console.log(`Interest Rate Model: ${marketParams.irm}`);
    console.log(`LLTV: ${marketParams.lltv / 1e18}`); // LLTV is in WAD (18 decimals)
    
    // Now fetch the interest rate model configuration
    const irmContract = new web3.eth.Contract(IRM_ABI, marketParams.irm);
    
    try {
      const utilizationTarget = await irmContract.methods.UTILIZATION_TARGET().call();
      const utilizationTargetPercent = (utilizationTarget / 1e18 * 100).toFixed(2);
      console.log(`Utilization Target: ${utilizationTargetPercent}%`); // Convert from WAD to percentage
      return utilizationTargetPercent;
    } catch (error) {
      console.error('Error fetching utilization target:', error);
      console.log('The interest rate model may not have a UTILIZATION_TARGET constant.');
      return null;
    }
  } catch (error) {
    console.error('Error fetching market configuration:', error);
    throw error;
  }
}

// Main function
async function main() {
  // cbBTC/USDC Market ID - replace with the active market ID from supplyBorrowLiq.js output
  const marketId = 'f6bdf547-ff28-429b-b81d-d98574a6fbcd';
  
  try {
    await fetchUtilizationTarget(marketId);
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

// Execute the main function
main(); 