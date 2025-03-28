import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { CBBTC_USDC_MARKET_ID, getBaseSubgraphEndpoint } from './state/common.js';

// Load environment variables from .env.private
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.private') });

// Function to make a GraphQL request to the Base subgraph
async function makeGraphQLRequest(query, variables = {}) {
  try {
    // Get the subgraph endpoint
    const endpoint = getBaseSubgraphEndpoint();
    
    console.log(`Using endpoint: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    const jsonResponse = await response.json();
    
    if (jsonResponse.errors) {
      console.error('GraphQL Errors:', jsonResponse.errors);
      throw new Error('GraphQL request failed');
    }
    
    return jsonResponse.data;
  } catch (error) {
    console.error('Error making GraphQL request:', error);
    throw error;
  }
}

// Function to fetch market data
async function fetchMarketData() {
  const query = `
    {
      market(id: "${CBBTC_USDC_MARKET_ID}") {
        id
        name
        inputToken {
          symbol
          decimals
        }
        borrowedToken {
          symbol
          decimals
        }
        totalSupply
        totalBorrow
        inputTokenBalance
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Function to fetch both deposits and withdrawals for analysis
async function fetchDepositAndWithdrawals(limit = 1000) {
  const query = `
    {
      deposits(
        first: ${limit}
        orderBy: amount
        orderDirection: desc
        where: {
          market: "${CBBTC_USDC_MARKET_ID}"
        }
      ) {
        id
        account {
          id
        }
        amount
        asset {
          symbol
          decimals
        }
        timestamp
      }
      
      withdraws(
        first: ${limit}
        orderBy: amount
        orderDirection: desc
        where: {
          market: "${CBBTC_USDC_MARKET_ID}"
        }
      ) {
        id
        account {
          id
        }
        amount
        asset {
          symbol
          decimals
        }
        timestamp
      }
    }
  `;
  
  return await makeGraphQLRequest(query);
}

// Main function to execute the query
async function main() {
  try {
    console.log('Fetching top supplier for cbBTC/USDC market on Base...');
    
    // First, fetch the market data to get the total supply amount
    console.log('Fetching market data...');
    const marketData = await fetchMarketData();
    
    if (!marketData || !marketData.market) {
      console.error('Failed to fetch market data');
      return;
    }
    
    const market = marketData.market;
    console.log(`Market: ${market.name || 'cbBTC/USDC'}`);
    
    // Get total supply in borrowed token (USDC)
    const borrowedTokenDecimals = parseInt(market.borrowedToken.decimals);
    const totalSupply = parseFloat(market.totalSupply) / (10 ** borrowedTokenDecimals);
    console.log(`Total Supply: ${totalSupply.toLocaleString()} ${market.borrowedToken.symbol}`);
    
    // Now fetch transactions for the market
    console.log('\nFetching deposits and withdrawals...');
    const txData = await fetchDepositAndWithdrawals();
    
    if (!txData || !txData.deposits || txData.deposits.length === 0) {
      console.log('No deposits found for this market.');
      return;
    }
    
    console.log(`Found ${txData.deposits.length} deposits and ${txData.withdraws ? txData.withdraws.length : 0} withdrawals in the market.`);
    
    // Calculate net balance per account considering both deposits and withdrawals
    const accountNetBalances = {};
    
    // Process deposits
    txData.deposits.forEach(deposit => {
      const accountId = deposit.account.id;
      const decimals = parseInt(deposit.asset.decimals);
      const amount = parseFloat(deposit.amount) / (10 ** decimals);
      
      if (!accountNetBalances[accountId]) {
        accountNetBalances[accountId] = {
          accountId: accountId,
          netBalance: 0,
          symbol: deposit.asset.symbol,
          lastActivity: parseInt(deposit.timestamp),
          depositCount: 0,
          totalDeposited: 0
        };
      }
      
      accountNetBalances[accountId].netBalance += amount;
      accountNetBalances[accountId].totalDeposited += amount;
      accountNetBalances[accountId].depositCount++;
      
      // Update last activity time if this is more recent
      const txTime = parseInt(deposit.timestamp);
      if (txTime > accountNetBalances[accountId].lastActivity) {
        accountNetBalances[accountId].lastActivity = txTime;
      }
    });
    
    // Process withdrawals (if available)
    if (txData.withdraws) {
      txData.withdraws.forEach(withdrawal => {
        const accountId = withdrawal.account.id;
        const decimals = parseInt(withdrawal.asset.decimals);
        const amount = parseFloat(withdrawal.amount) / (10 ** decimals);
        
        if (!accountNetBalances[accountId]) {
          // This is unusual but could happen if we have withdrawal data but not the corresponding deposit
          accountNetBalances[accountId] = {
            accountId: accountId,
            netBalance: 0,
            symbol: withdrawal.asset.symbol,
            lastActivity: parseInt(withdrawal.timestamp),
            depositCount: 0,
            totalDeposited: 0
          };
        }
        
        // Subtract withdrawal from net balance
        accountNetBalances[accountId].netBalance -= amount;
        
        // Update last activity time if this is more recent
        const txTime = parseInt(withdrawal.timestamp);
        if (txTime > accountNetBalances[accountId].lastActivity) {
          accountNetBalances[accountId].lastActivity = txTime;
        }
      });
    }
    
    // Calculate net balance after deposits and withdrawals, filtered to accounts with positive balances
    const activeSuppliers = Object.values(accountNetBalances)
      .filter(account => account.netBalance > 0)
      .sort((a, b) => b.netBalance - a.netBalance);
    
    // Calculate the sum of all estimated net balances
    const totalNetBalances = activeSuppliers.reduce((sum, account) => sum + account.netBalance, 0);
    const balancePercentOfTotal = (totalNetBalances / totalSupply) * 100;
    
    console.log(`\nEstimated total net supplier balances: ${totalNetBalances.toLocaleString()} ${activeSuppliers[0]?.symbol || 'USDC'}`);
    console.log(`This represents approximately ${balancePercentOfTotal.toFixed(2)}% of the total supply`);
    
    // Get the top supplier
    if (activeSuppliers.length === 0) {
      console.log('\nNo active suppliers found for this market.');
      return;
    }
    
    const topSupplier = activeSuppliers[0];
    
    // Calculate percentage stats
    topSupplier.percentOfTotalSupply = (topSupplier.netBalance / totalSupply) * 100;
    topSupplier.percentOfMappedSupply = (topSupplier.netBalance / totalNetBalances) * 100;
    
    // Display result
    console.log('\nTop Supplier to cbBTC/USDC Market:');
    console.log('===================================');
    
    console.log(`Address: ${topSupplier.accountId}`);
    console.log(`Estimated Net Balance: ${topSupplier.netBalance.toLocaleString()} ${topSupplier.symbol}`);
    console.log(`% of Total Supply: ${topSupplier.percentOfTotalSupply.toFixed(2)}%`);
    console.log(`% of Mapped Supply: ${topSupplier.percentOfMappedSupply.toFixed(2)}%`);
    console.log(`Total Ever Deposited: ${topSupplier.totalDeposited.toLocaleString()} ${topSupplier.symbol}`);
    console.log(`Last Activity: ${new Date(topSupplier.lastActivity * 1000).toISOString()}`);
    
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

// Execute the main function
main();