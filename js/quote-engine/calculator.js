/**
 * Quote Calculation Engine v2
 * Deterministic pricing calculation based on service type, sqft, frequency, touchpoints, and complexity
 */

import { QUOTE_CONFIG, getSqftBand, getFrequencyMultiplier } from './config.js';

/**
 * Calculate quote from inputs
 * @param {Object} inputs - Quote input parameters
 * @param {string} inputs.service_type - Service type (commercial_office, medical_clinic, etc.)
 * @param {number} [inputs.sqft_estimate] - Square footage estimate (optional)
 * @param {number} inputs.frequency_per_month - Visits per month
 * @param {number} [inputs.num_washrooms=0] - Number of washrooms
 * @param {number} [inputs.num_treatment_rooms=0] - Number of treatment rooms
 * @param {boolean} [inputs.has_reception=false] - Has reception area
 * @param {boolean} [inputs.has_kitchen=false] - Has kitchen
 * @param {string} [inputs.flooring='mostly_hard'] - Flooring type (mostly_hard, mixed, mostly_carpet)
 * @param {boolean} [inputs.after_hours_required=false] - After hours service required
 * @param {boolean} [inputs.supplies_included=true] - Supplies included
 * @param {boolean} [inputs.high_touch_disinfection=false] - High touch disinfection (default true for healthcare)
 * @param {number} [inputs.urgency_start_days=30] - Days until start (0-30)
 * @param {string} [inputs.notes=''] - Additional notes
 * @returns {Object} Quote calculation result
 */
export function calculateQuote(inputs) {
  // Validate required inputs
  if (!inputs.service_type) {
    throw new Error('service_type is required');
  }
  if (!inputs.frequency_per_month || inputs.frequency_per_month <= 0) {
    throw new Error('frequency_per_month must be greater than 0');
  }

  // Set defaults
  const sqft = inputs.sqft_estimate || null;
  const numWashrooms = inputs.num_washrooms || 0;
  const numTreatmentRooms = inputs.num_treatment_rooms || 0;
  const hasReception = inputs.has_reception || false;
  const hasKitchen = inputs.has_kitchen || false;
  const flooring = inputs.flooring || 'mostly_hard';
  const afterHours = inputs.after_hours_required || false;
  const suppliesIncluded = inputs.supplies_included !== false; // Default true
  const highTouchDisinfection = inputs.high_touch_disinfection || 
    ['medical_clinic', 'dental', 'physio_chiro', 'optical'].includes(inputs.service_type);
  const urgencyDays = inputs.urgency_start_days !== undefined ? inputs.urgency_start_days : 30;
  const notes = (inputs.notes || '').toLowerCase();

  // Get base price
  const basePrice = QUOTE_CONFIG.basePrices[inputs.service_type];
  if (!basePrice) {
    throw new Error(`Invalid service_type: ${inputs.service_type}`);
  }

  // Determine sqft band
  const sqftBand = getSqftBand(sqft);
  const estimationRequired = !sqft || sqft <= 0;

  // Check if custom-only (requires walkthrough)
  if (sqftBand.customOnly) {
    return {
      status: 'requires_walkthrough',
      walkthrough_required: true,
      price_range: null,
      recommended_action: 'book_walkthrough',
      estimation_required: true,
      message: 'Square footage exceeds maximum for automatic quoting. Walkthrough required.'
    };
  }

  // Get frequency multiplier
  const freqMultiplier = getFrequencyMultiplier(inputs.frequency_per_month);
  if (freqMultiplier.customOnly) {
    return {
      status: 'requires_walkthrough',
      walkthrough_required: true,
      price_range: null,
      recommended_action: 'book_walkthrough',
      estimation_required: false,
      message: 'Frequency exceeds maximum for automatic quoting. Walkthrough required.'
    };
  }

  // Calculate touchpoint multiplier
  let touchpointScore = 0;
  
  // Washrooms (cap at 4 = 0.24)
  touchpointScore += Math.min(numWashrooms * QUOTE_CONFIG.touchpointScores.washroom, 0.24);
  
  // Treatment rooms (cap at 5 = 0.20)
  touchpointScore += Math.min(numTreatmentRooms * QUOTE_CONFIG.touchpointScores.treatment_room, 0.20);
  
  // Reception
  if (hasReception) {
    touchpointScore += QUOTE_CONFIG.touchpointScores.reception;
  }
  
  // Kitchen
  if (hasKitchen) {
    touchpointScore += QUOTE_CONFIG.touchpointScores.kitchen;
  }
  
  // High touch disinfection
  if (highTouchDisinfection) {
    touchpointScore += QUOTE_CONFIG.touchpointScores.high_touch_disinfection;
  }
  
  // Cap touchpoint score
  touchpointScore = Math.min(touchpointScore, QUOTE_CONFIG.touchpointMax);
  const touchpointMultiplier = 1 + touchpointScore;

  // Calculate complexity multiplier
  let complexityScore = 0;
  
  // Flooring
  const flooringFactor = QUOTE_CONFIG.complexityFactors.flooring[flooring] || 0;
  complexityScore += flooringFactor;
  
  // After hours
  if (afterHours) {
    complexityScore += QUOTE_CONFIG.complexityFactors.after_hours;
  }
  
  // Supplies included
  if (suppliesIncluded) {
    complexityScore += QUOTE_CONFIG.complexityFactors.supplies_included;
  }
  
  // Urgency
  let urgencyKey = '8+';
  if (urgencyDays <= 2) urgencyKey = '0-2';
  else if (urgencyDays <= 7) urgencyKey = '3-7';
  complexityScore += QUOTE_CONFIG.complexityFactors.urgency[urgencyKey];
  
  // Cap complexity score
  complexityScore = Math.min(complexityScore, QUOTE_CONFIG.complexityMax);
  const complexityMultiplier = 1 + complexityScore;

  // Calculate base monthly price
  let monthlyExHst = basePrice * 
    sqftBand.multiplier * 
    freqMultiplier.multiplier * 
    touchpointMultiplier * 
    complexityMultiplier;

  // Apply minimum floor
  const minimum = QUOTE_CONFIG.minimumMonthly[inputs.service_type];
  monthlyExHst = Math.max(monthlyExHst, minimum);

  // Round to nearest $10
  monthlyExHst = Math.round(monthlyExHst / QUOTE_CONFIG.rounding.monthly) * QUOTE_CONFIG.rounding.monthly;

  // Calculate per-visit price
  let perVisitPrice = monthlyExHst / inputs.frequency_per_month;
  perVisitPrice = Math.round(perVisitPrice / QUOTE_CONFIG.rounding.perVisit) * QUOTE_CONFIG.rounding.perVisit;

  // Calculate HST
  const hstAmount = Math.round(monthlyExHst * QUOTE_CONFIG.hstRate * 100) / 100;
  const monthlyIncHst = monthlyExHst + hstAmount;

  // Determine walkthrough requirement
  let walkthroughRequired = sqftBand.walkthroughRequired || false;
  
  // Check other triggers
  if (inputs.service_type === 'industrial') {
    walkthroughRequired = true;
  }
  
  if (numTreatmentRooms > QUOTE_CONFIG.walkthroughTriggers.maxTreatmentRooms) {
    walkthroughRequired = true;
  }
  
  // Check for custom keywords in notes
  for (const keyword of QUOTE_CONFIG.walkthroughTriggers.customKeywords) {
    if (notes.includes(keyword)) {
      walkthroughRequired = true;
      break;
    }
  }

  // Build line items breakdown
  const lineItems = [];
  
  // Base service
  const baseServiceAmount = basePrice * sqftBand.multiplier * freqMultiplier.multiplier;
  lineItems.push({
    name: 'Base Service',
    amount: Math.round(baseServiceAmount),
    description: `${inputs.service_type.replace(/_/g, ' ')} - ${sqftBand.label}`
  });
  
  // Touchpoint density
  if (touchpointScore > 0) {
    const touchpointAmount = baseServiceAmount * (touchpointMultiplier - 1);
    lineItems.push({
      name: 'Touchpoint Density Premium',
      amount: Math.round(touchpointAmount),
      description: `Additional touchpoints: ${numWashrooms} washrooms, ${numTreatmentRooms} treatment rooms${hasReception ? ', reception' : ''}${hasKitchen ? ', kitchen' : ''}${highTouchDisinfection ? ', high-touch disinfection' : ''}`
    });
  }
  
  // Complexity premium
  if (complexityScore > 0) {
    const complexityAmount = baseServiceAmount * touchpointMultiplier * (complexityMultiplier - 1);
    const complexityDetails = [];
    if (flooring !== 'mostly_hard') complexityDetails.push(flooring.replace(/_/g, ' ') + ' flooring');
    if (afterHours) complexityDetails.push('after hours');
    if (suppliesIncluded) complexityDetails.push('supplies included');
    if (urgencyDays <= 7) complexityDetails.push(`${urgencyDays} day start`);
    
    lineItems.push({
      name: 'Complexity Premium',
      amount: Math.round(complexityAmount),
      description: complexityDetails.join(', ')
    });
  }

  // Recommended frequency upsell
  let recommendedFrequencyUpsell = null;
  if (inputs.frequency_per_month < 4 && ['medical_clinic', 'dental'].includes(inputs.service_type)) {
    recommendedFrequencyUpsell = 'Consider weekly service (4 visits/month) for optimal healthcare environment maintenance';
  }

  // Build assumptions
  const assumptions = {
    sqft_cap: sqftBand.max,
    band_label: sqftBand.label,
    supplies_included: suppliesIncluded,
    healthcare_disinfection: highTouchDisinfection && ['medical_clinic', 'dental', 'physio_chiro', 'optical'].includes(inputs.service_type),
    estimation_required: estimationRequired
  };

  return {
    status: 'quote',
    monthly_price_ex_hst: monthlyExHst,
    hst_amount: hstAmount,
    monthly_price_inc_hst: monthlyIncHst,
    per_visit_price: perVisitPrice,
    assumptions: assumptions,
    line_items: lineItems,
    recommended_frequency_upsell: recommendedFrequencyUpsell,
    quote_valid_for_days: QUOTE_CONFIG.quoteValidForDays,
    walkthrough_required: walkthroughRequired,
    recommended_action: walkthroughRequired ? 'book_walkthrough' : 'send_quote',
    calculation_breakdown: {
      base_price: basePrice,
      sqft_band_multiplier: sqftBand.multiplier,
      frequency_multiplier: freqMultiplier.multiplier,
      touchpoint_multiplier: touchpointMultiplier,
      complexity_multiplier: complexityMultiplier,
      touchpoint_score: touchpointScore,
      complexity_score: complexityScore
    }
  };
}

/**
 * Get scope bullets for service type
 * @param {string} serviceType - Service type
 * @param {Object} inputs - Quote inputs (for conditional bullets)
 * @returns {Array<string>} Array of scope bullet points
 */
export function getScopeBullets(serviceType, inputs = {}) {
  const bullets = [];
  
  const isHealthcare = ['medical_clinic', 'dental', 'physio_chiro', 'optical'].includes(serviceType);
  const hasTreatmentRooms = (inputs.num_treatment_rooms || 0) > 0;
  const hasReception = inputs.has_reception || false;
  const hasKitchen = inputs.has_kitchen || false;
  const numWashrooms = inputs.num_washrooms || 0;
  
  if (isHealthcare) {
    bullets.push('Full clean and sanitization');
    bullets.push('High-touch disinfection on all surfaces');
    if (hasTreatmentRooms) {
      bullets.push(`${inputs.num_treatment_rooms} treatment room${inputs.num_treatment_rooms > 1 ? 's' : ''}`);
    }
    if (hasReception) {
      bullets.push('Reception area');
    }
    if (numWashrooms > 0) {
      bullets.push(`${numWashrooms} washroom${numWashrooms > 1 ? 's' : ''}`);
    }
    if (hasKitchen) {
      bullets.push('Staff kitchen/break area');
    }
    bullets.push('Floor care and maintenance');
  } else if (serviceType === 'commercial_office') {
    bullets.push('General cleaning');
    bullets.push('High-touch point sanitization');
    if (hasKitchen) {
      bullets.push('Kitchen/break area');
    }
    if (numWashrooms > 0) {
      bullets.push(`${numWashrooms} washroom${numWashrooms > 1 ? 's' : ''}`);
    }
    bullets.push('Floor care');
  } else if (serviceType === 'industrial') {
    bullets.push('Industrial cleaning services');
    bullets.push('High-touch point sanitization');
    if (numWashrooms > 0) {
      bullets.push(`${numWashrooms} washroom${numWashrooms > 1 ? 's' : ''}`);
    }
    bullets.push('Floor care');
  } else if (serviceType === 'residential_common_area') {
    bullets.push('Common area cleaning');
    bullets.push('High-touch point sanitization');
    if (numWashrooms > 0) {
      bullets.push(`${numWashrooms} washroom${numWashrooms > 1 ? 's' : ''}`);
    }
    bullets.push('Floor care');
  }
  
  return bullets;
}
