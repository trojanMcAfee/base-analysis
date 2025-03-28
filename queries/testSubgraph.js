import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { MORPHO_CONTRACT_ADDRESS, CBBTC_USDC_MARKET_ID } from './state/common.js';

// Load environment variables
dotenv.config();

// ABI fragment for the position function
const ABI_FRAGMENT = [
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

async function main() {
  try {
    // Connect to Base chain
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);

    // User address to query
    const userAddress = '0x995fE46E7B12090bD98Cf200E912b9c07a935bBA';

    // Get the current block number
    const blockNumber = await provider.getBlockNumber();
    console.log(`Querying at block number: ${blockNumber}`);

    // Create contract instance
    const morphoContract = new ethers.Contract(
      MORPHO_CONTRACT_ADDRESS,
      ABI_FRAGMENT,
      provider
    );

    // Call the position function
    const position = await morphoContract.position(
      CBBTC_USDC_MARKET_ID,
      userAddress
    );

    console.log('Position data:');
    console.log('Supply Shares:', position.supplyShares.toString());
    console.log('Borrow Shares:', position.borrowShares.toString());
    console.log('Collateral:', position.collateral.toString());

  } catch (error) {
    console.error('Error querying position:', error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 