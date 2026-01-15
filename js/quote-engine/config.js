/**
 * Quote Engine Configuration
 * Admin-editable pricing rules and multipliers
 * Update these values to adjust pricing without touching core calculation logic
 */

export const QUOTE_CONFIG = {
  // Base monthly prices (ex-HST) for 4 visits/mo, 1200-1600 sqft band (baseline)
  basePrices: {
    commercial_office: 349,
    physio_chiro: 579,
    medical_clinic: 649,
    dental: 699,
    optical: 599,
    industrial: 799,
    residential_common_area: 499
  },

  // Sqft bands with multipliers
  // Baseline is band_2 (1201-1600 sqft) with multiplier 1.00
  sqftBands: [
    { min: 0, max: 1200, multiplier: 0.92, label: 'band_1', walkthroughRequired: false },
    { min: 1201, max: 1600, multiplier: 1.00, label: 'band_2', walkthroughRequired: false }, // baseline
    { min: 1601, max: 2000, multiplier: 1.14, label: 'band_3', walkthroughRequired: false },
    { min: 2001, max: 2600, multiplier: 1.32, label: 'band_4', walkthroughRequired: true },
    { min: 2601, max: 3500, multiplier: 1.55, label: 'band_5', walkthroughRequired: true },
    { min: 3501, max: Infinity, multiplier: null, label: 'band_6', customOnly: true, walkthroughRequired: true }
  ],

  // Frequency multipliers (non-linear curve)
  // Based on visits per month
  frequencyMultipliers: [
    { maxVisits: 4, multiplier: 1.00 },
    { maxVisits: 8, multiplier: 1.80 },
    { maxVisits: 12, multiplier: 2.45 },
    { maxVisits: 16, multiplier: 3.05 },
    { maxVisits: 20, multiplier: 3.70 },
    { maxVisits: Infinity, multiplier: null, customOnly: true }
  ],

  // Touchpoint scoring (additive, then converted to multiplier)
  // Each touchpoint adds to a score, which becomes a multiplier
  touchpointScores: {
    washroom: 0.08,        // per washroom, cap at 0.32 (4 washrooms max)
    treatment_room: 0.05,  // per room, cap at 0.25 (5 rooms max)
    reception: 0.06,
    kitchen: 0.06,
    high_touch_disinfection: 0.08
  },
  touchpointMax: 0.45,  // Cap total touchpoint score at 0.45 (i.e. max multiplier = 1.45)

  // Complexity factors (additive, then converted to multiplier)
  complexityFactors: {
    flooring: {
      mostly_hard: 0.00,
      mixed: 0.06,
      mostly_carpet: 0.10
    },
    after_hours: 0.08,
    supplies_included: 0.06,  // if true
    urgency: {
      '0-2': 0.10,   // 0-2 days = urgent
      '3-7': 0.05,   // 3-7 days = moderate
      '8+': 0.00     // 8+ days = normal
    }
  },
  complexityMax: 0.30,  // Cap complexity adders at 0.30 (i.e. max multiplier = 1.30)

  // Minimum monthly floors (same as base prices or higher)
  minimumMonthly: {
    commercial_office: 349,
    physio_chiro: 579,
    medical_clinic: 649,
    dental: 699,
    optical: 599,
    industrial: 799,
    residential_common_area: 499
  },

  // HST rate (Ontario default)
  hstRate: 0.13,

  // Walkthrough triggers
  walkthroughTriggers: {
    maxSqftBand: 3,  // band_3 = 2000 sqft max without walkthrough
    maxTreatmentRooms: 8,
    customKeywords: ['construction dust', 'biohazard', 'flood', 'mold']
  },

  // Quote validity period
  quoteValidForDays: 14,

  // Rounding rules
  rounding: {
    monthly: 10,    // Round to nearest $10
    perVisit: 5     // Round to nearest $5
  }
};

/**
 * Get sqft band for given square footage
 * @param {number} sqft - Square footage
 * @returns {Object} Band object with multiplier, label, etc.
 */
export function getSqftBand(sqft) {
  if (!sqft || sqft <= 0) {
    // Use conservative default (band_1) if sqft missing
    return QUOTE_CONFIG.sqftBands[0];
  }

  for (const band of QUOTE_CONFIG.sqftBands) {
    if (sqft >= band.min && sqft <= band.max) {
      return band;
    }
  }

  // Fallback to last band (custom only)
  return QUOTE_CONFIG.sqftBands[QUOTE_CONFIG.sqftBands.length - 1];
}

/**
 * Get frequency multiplier for given visits per month
 * @param {number} visitsPerMonth - Number of visits per month
 * @returns {Object} Multiplier object or null if custom_only
 */
export function getFrequencyMultiplier(visitsPerMonth) {
  if (!visitsPerMonth || visitsPerMonth <= 0) {
    visitsPerMonth = 4; // Default to weekly
  }

  for (const freq of QUOTE_CONFIG.frequencyMultipliers) {
    if (visitsPerMonth <= freq.maxVisits) {
      return freq;
    }
  }

  // >20 visits = custom only
  return { maxVisits: Infinity, multiplier: null, customOnly: true };
}
