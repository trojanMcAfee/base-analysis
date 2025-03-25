// Shared constants and variables used across scripts

// Math constants for calculations
export const VIRTUAL_SHARES = BigInt(1e6);
export const VIRTUAL_ASSETS = BigInt(1);

// Asset decimal adjustment factors
export const BORROWED_AMOUNT_DECIMALS = BigInt(10) ** BigInt(6); // 1e6
export const ORACLE_PRICE_DECIMALS = BigInt(10) ** BigInt(8);    // 1e8
export const COLLATERAL_AMOUNT_DECIMALS = BigInt(10) ** BigInt(8); // 1e8

// Contract addresses
export const MORPHO_CONTRACT_ADDRESS = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb';
export const CHAINLINK_ORACLE_ADDRESS = '0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F';
export const REDSTONE_BTC_USD_FEED = '0x13433B1949d9141Be52Ae13Ad7e7E4911228414e';

// Market IDs
export const CBBTC_USDC_MARKET_ID = '0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836';
export const GRAPHQL_MARKET_ID = 'f6bdf547-ff28-429b-b81d-d98574a6fbcd';

// Default test values
export const USER_ADDRESS = '0xc10f94115d1dc2D042B88b3Cc86D34380C55CEf5';
export const BLOCK_NUMBER = 27884440;
export const DEFAULT_BTC_BALANCE = 0.2;

// GraphQL endpoint
export const MORPHO_GRAPHQL_ENDPOINT = 'https://blue-api.morpho.org/graphql';

// Base chain subgraph constants
export const SUBGRAPH_ID = '71ZTy1veF9twER9CLMnPWeLQ7GZcwKsjmygejrgKirqs';
export function getBaseSubgraphEndpoint() {
  return `https://gateway.thegraph.com/api/${process.env.THE_GRAPH_API_KEY}/subgraphs/id/${SUBGRAPH_ID}`;
}

// Utility functions for big number math
export function mulDivUp(x, y, d) {
  // (x * y + (d - 1)) / d
  const numerator = (x * y) + (d - BigInt(1));
  return numerator / d;
}

export function toAssetsUp(shares, totalAssets, totalShares) {
  return mulDivUp(
    shares,
    totalAssets + VIRTUAL_ASSETS,
    totalShares + VIRTUAL_SHARES
  );
}

// Function to calculate borrowed amount
export function calculateBorrowedAmount(borrowShares, totalBorrowAssets, totalBorrowShares) {
  // Convert all values to BigInt for accurate calculation
  const shares = BigInt(borrowShares.toString());
  const assets = BigInt(totalBorrowAssets.toString());
  const totalShares = BigInt(totalBorrowShares.toString());
  
  // Calculate borrowed amount using toAssetsUp function
  return toAssetsUp(shares, assets, totalShares);
}

// Function to parse LLTV from string to decimal
export function parseLLTVToDecimal(lltvValue) {
  // The LLTV is stored as a fixed-point number with 18 decimals
  return parseFloat(lltvValue) / 1e18;
} 