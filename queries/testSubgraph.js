import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  MORPHO_CONTRACT_ADDRESS, 
  CBBTC_USDC_MARKET_ID,
  USDC_BASE_ADDRESS,
  cbBTC_BASE_ADDRESS,
  cbBTC_USDC_ORACLE_ADDRESS,
  cbBTC_USDC_IRM_ADDRESS 
} from './state/common.js';
import { morphoABI } from './state/abis.js';

// Setup directory name for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env.private
dotenv.config({ path: path.resolve(__dirname, '../.env.private') });

async function main() {
  try {
    // Connect to Base chain using Alchemy RPC from .env.private
    const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // User address to query
    const userAddress = '0x995fE46E7B12090bD98Cf200E912b9c07a935bBA';

    // Get the current block number
    const blockNumber = await provider.getBlockNumber();
    console.log(`Querying at block number: ${blockNumber}`);

    // Create contract instance with full ABI
    const morphoContract = new ethers.Contract(
      MORPHO_CONTRACT_ADDRESS,
      morphoABI,
      provider
    );

    // Connected contract with signer for transactions
    const morphoContractWithSigner = morphoContract.connect(wallet);

    // Call the position function BEFORE borrowing
    console.log('Position data BEFORE borrowing:');
    const positionBefore = await morphoContract.position(
      CBBTC_USDC_MARKET_ID,
      userAddress
    );

    console.log('Supply Shares:', positionBefore.supplyShares.toString());
    console.log('Borrow Shares:', positionBefore.borrowShares.toString());
    console.log('Collateral:', positionBefore.collateral.toString());

    // Borrow parameters
    const marketParams = {
      loanToken: USDC_BASE_ADDRESS,
      collateralToken: cbBTC_BASE_ADDRESS,
      oracle: cbBTC_USDC_ORACLE_ADDRESS,
      irm: cbBTC_USDC_IRM_ADDRESS,
      lltv: ethers.parseUnits('86', 16) // 86 * 1e16
    };
    
    const borrowAmount = ethers.parseUnits('10', 6); // 10 USDC with 6 decimals
    const shares = 0;
    const onBehalf = userAddress;
    const receiver = userAddress;

    console.log('Borrowing 10 USDC...');
    
    try {
      // Execute borrow transaction
      const borrowTx = await morphoContractWithSigner.borrow(
        marketParams,
        borrowAmount,
        shares,
        onBehalf,
        receiver
      );
      
      console.log('Borrow transaction sent:', borrowTx.hash);
      
      // Get the current block number immediately after sending transaction
      const immediateBlockNumber = await provider.getBlockNumber();
      console.log(`Querying position immediately after transaction sent at block number: ${immediateBlockNumber}`);

      // Call the position function immediately after sending the borrow transaction
      console.log('Position data IMMEDIATELY after transaction:');
      const positionImmediate = await morphoContract.position(
        CBBTC_USDC_MARKET_ID,
        userAddress
      );

      console.log('Supply Shares:', positionImmediate.supplyShares.toString());
      console.log('Borrow Shares:', positionImmediate.borrowShares.toString());
      console.log('Collateral:', positionImmediate.collateral.toString());
      
      // Wait for transaction to be mined
      const receipt = await borrowTx.wait();
      console.log('Borrow transaction confirmed in block:', receipt.blockNumber);

      // Get the current block number after confirmation
      const afterBlockNumber = await provider.getBlockNumber();
      console.log(`Querying position after transaction confirmation at block number: ${afterBlockNumber}`);

      // Call the position function AFTER borrowing is confirmed
      console.log('Position data AFTER borrowing confirmation:');
      const positionAfter = await morphoContract.position(
        CBBTC_USDC_MARKET_ID,
        userAddress
      );

      console.log('Supply Shares:', positionAfter.supplyShares.toString());
      console.log('Borrow Shares:', positionAfter.borrowShares.toString());
      console.log('Collateral:', positionAfter.collateral.toString());
      
    } catch (borrowError) {
      console.error('Error during borrow operation:', borrowError);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}




// Function to query position at a specific block number
async function main2() {
  try {
    // Connect to Base chain using Alchemy RPC from .env.private
    const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_RPC_URL);
    
    // User address to query - same as in main()
    const userAddress = '0x995fE46E7B12090bD98Cf200E912b9c07a935bBA';
    
    // The specific block number to query
    const specificBlockNumber = 28192408;
    console.log(`Querying position at specific block number: ${specificBlockNumber}`);
    
    // Create contract instance with full ABI
    const morphoContract = new ethers.Contract(
      MORPHO_CONTRACT_ADDRESS,
      morphoABI,
      provider
    );
    
    // Call the position function at the specific block
    console.log('Position data at block 28192408:');
    const position = await morphoContract.position(
      CBBTC_USDC_MARKET_ID,
      userAddress,
      { blockTag: specificBlockNumber }
    );
    
    console.log('Supply Shares:', position.supplyShares.toString());
    console.log('Borrow Shares:', position.borrowShares.toString());
    console.log('Collateral:', position.collateral.toString());
    
  } catch (error) {
    console.error('Error in main2:', error);
  }
} 



main2()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 