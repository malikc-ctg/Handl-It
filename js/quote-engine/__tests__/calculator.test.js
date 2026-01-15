/**
 * Quote Calculator Unit Tests
 * Run with: node --experimental-modules calculator.test.js
 * Or integrate with your test framework
 */

import { calculateQuote } from '../calculator.js';

// Test helper to run tests
function runTest(name, fn) {
  try {
    const result = fn();
    if (result === true || (result && result.passed)) {
      console.log(`✅ ${name}`);
      return true;
    } else {
      console.error(`❌ ${name}: ${result.message || 'Failed'}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`);
    return false;
  }
}

// Test 1: MEX Physio scenario
runTest('MEX Physio scenario', () => {
  const inputs = {
    service_type: 'physio_chiro',
    sqft_estimate: 1000,
    frequency_per_month: 4,
    num_washrooms: 1,
    num_treatment_rooms: 3,
    has_reception: true,
    has_kitchen: true,
    after_hours_required: true,
    supplies_included: true,
    high_touch_disinfection: true,
    flooring: 'mostly_hard',
    urgency_start_days: 30
  };
  
  const result = calculateQuote(inputs);
  
  // Should be in expected range
  const inRange = result.monthly_price_ex_hst >= 529 && result.monthly_price_ex_hst <= 649;
  const hasHealthcare = result.assumptions.healthcare_disinfection === true;
  const correctBand = result.assumptions.band_label === 'band_1';
  
  return inRange && hasHealthcare && correctBand;
});

// Test 2: Dental 1500 sqft
runTest('Dental 1500 sqft, 4/mo', () => {
  const inputs = {
    service_type: 'dental',
    sqft_estimate: 1500,
    frequency_per_month: 4,
    num_washrooms: 2,
    num_treatment_rooms: 4,
    has_reception: true,
    has_kitchen: true,
    supplies_included: true,
    high_touch_disinfection: true
  };
  
  const result = calculateQuote(inputs);
  
  const inRange = result.monthly_price_ex_hst >= 599 && result.monthly_price_ex_hst <= 799;
  const correctBand = result.assumptions.band_label === 'band_2';
  const higherThanPhysio = result.monthly_price_ex_hst > 579; // Should be higher than physio base
  
  return inRange && correctBand && higherThanPhysio;
});

// Test 3: Office 1500 sqft
runTest('Office 1500 sqft, 4/mo', () => {
  const inputs = {
    service_type: 'commercial_office',
    sqft_estimate: 1500,
    frequency_per_month: 4,
    num_washrooms: 1,
    has_kitchen: true,
    supplies_included: true
  };
  
  const result = calculateQuote(inputs);
  
  const inRange = result.monthly_price_ex_hst >= 349 && result.monthly_price_ex_hst <= 449;
  const correctBand = result.assumptions.band_label === 'band_2';
  const lowerThanHealthcare = result.monthly_price_ex_hst < 579; // Should be lower than healthcare
  
  return inRange && correctBand && lowerThanHealthcare;
});

// Test 4: >3500 sqft (custom only)
runTest('>3500 sqft requires walkthrough', () => {
  const inputs = {
    service_type: 'commercial_office',
    sqft_estimate: 4000,
    frequency_per_month: 4
  };
  
  const result = calculateQuote(inputs);
  
  return result.status === 'requires_walkthrough' && 
         result.walkthrough_required === true &&
         result.recommended_action === 'book_walkthrough';
});

// Test 5: Missing sqft uses default band
runTest('Missing sqft uses conservative default', () => {
  const inputs = {
    service_type: 'commercial_office',
    frequency_per_month: 4
  };
  
  const result = calculateQuote(inputs);
  
  return result.assumptions.band_label === 'band_1' &&
         result.assumptions.estimation_required === true;
});

// Test 6: High frequency (>20) requires walkthrough
runTest('High frequency (>20) requires walkthrough', () => {
  const inputs = {
    service_type: 'commercial_office',
    sqft_estimate: 1500,
    frequency_per_month: 25
  };
  
  const result = calculateQuote(inputs);
  
  return result.status === 'requires_walkthrough';
});

// Test 7: Industrial always requires walkthrough
runTest('Industrial service type requires walkthrough', () => {
  const inputs = {
    service_type: 'industrial',
    sqft_estimate: 1500,
    frequency_per_month: 4
  };
  
  const result = calculateQuote(inputs);
  
  return result.walkthrough_required === true;
});

// Test 8: Custom keywords trigger walkthrough
runTest('Custom keywords trigger walkthrough', () => {
  const inputs = {
    service_type: 'commercial_office',
    sqft_estimate: 1500,
    frequency_per_month: 4,
    notes: 'There is construction dust in the facility'
  };
  
  const result = calculateQuote(inputs);
  
  return result.walkthrough_required === true;
});

// Test 9: Minimum floor applied
runTest('Minimum floor is applied', () => {
  const inputs = {
    service_type: 'dental',
    sqft_estimate: 500, // Very small, should hit minimum
    frequency_per_month: 2, // Low frequency
    num_washrooms: 0,
    num_treatment_rooms: 0
  };
  
  const result = calculateQuote(inputs);
  
  // Should be at least the minimum (699 for dental)
  return result.monthly_price_ex_hst >= 699;
});

// Test 10: Rounding rules
runTest('Monthly price rounded to nearest $10', () => {
  const inputs = {
    service_type: 'commercial_office',
    sqft_estimate: 1500,
    frequency_per_month: 4
  };
  
  const result = calculateQuote(inputs);
  
  // Should be divisible by 10
  return result.monthly_price_ex_hst % 10 === 0;
});

runTest('Per-visit price rounded to nearest $5', () => {
  const inputs = {
    service_type: 'commercial_office',
    sqft_estimate: 1500,
    frequency_per_month: 4
  };
  
  const result = calculateQuote(inputs);
  
  // Should be divisible by 5
  return result.per_visit_price % 5 === 0;
});

console.log('\n--- Tests Complete ---\n');

// Export for use in test runners
export { runTest };
