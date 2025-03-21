import { calculateLTV, formatLTVAsPercentage } from './calculateLTV.js';
import { getLLTV, formatLLTV } from './supplyBorrowLiq.js';

// Function to determine position status based on LTV value
async function evaluatePositionStatus() {
  try {
    // Get the LTV value
    console.log('Calculating LTV...');
    const ltv = await calculateLTV();
    
    if (ltv === null) {
      console.log('\nFailed to calculate LTV. Cannot determine position status.');
      return;
    }
    
    // Get the LLTV (liquidation LTV) value
    console.log('\nFetching liquidation LTV...');
    let lltv = await getLLTV();
    
    // We should always have an LLTV value now that we've added default fallbacks
    
    // Determine position status based on LTV ranges
    console.log('\nPosition Status Evaluation:');
    console.log('------------------------------------------');
    console.log('Current LTV:', formatLTVAsPercentage(ltv));
    console.log('Max LTV before liquidation:', lltv.toFixed(2) + '%');
    console.log('------------------------------------------');
    
    // Status evaluation
    let status;
    if (ltv <= 60) {
      status = 'Healthy (green)';
    } else if (ltv <= 70) {
      status = 'Caution (yellow)';
    } else if (ltv <= lltv) {
      status = 'Warning (red)';
    } else {
      status = 'Liquidation (critical)';
    }
    
    console.log('Status:', status);
    console.log('------------------------------------------');
    
    // Display the scale
    console.log('\nLTV Risk Scale:');
    console.log('0% - 60%: Healthy (green)');
    console.log('60% - 70%: Caution (yellow)');
    console.log(`70% - ${lltv.toFixed(2)}%: Warning (red)`);
    
    return status;
  } catch (error) {
    console.error('\nError evaluating position status:', error.message);
  }
}

// Execute the function if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  evaluatePositionStatus();
}

// Export function for use in other modules
export { evaluatePositionStatus }; 