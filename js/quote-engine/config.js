/**
 * Quote Engine Configuration
 * Admin-editable pricing rules and multipliers
 * Update these values to adjust pricing without touching core calculation logic
 */

export const QUOTE_CONFIG = {
  // Base monthly prices (ex-HST) for 4 visits/mo, 1200-1600 sqft band (baseline)
  basePrices: {
    commercial_office: 349,
    physio_chiro: 499,
    medical_clinic: 549,
    dental: 529,
    optical: 499,
    industrial: 699,
    residential_common_area: 499
  },

  // Sqft bands with multipliers
  // Baseline is band_2 (1201-1600 sqft) with multiplier 1.00
  sqftBands: [
    { min: 0, max: 1200, multiplier: 0.92, label: 'band_1', walkthroughRequired: false },
    { min: 1201, max: 1600, multiplier: 1.00, label: 'band_2', walkthroughRequired: false }, // baseline
    { min: 1601, max: 2000, multiplier: 1.05, label: 'band_3', walkthroughRequired: false },
    { min: 2001, max: 2600, multiplier: 1.10, label: 'band_4', walkthroughRequired: true },
    { min: 2601, max: 3500, multiplier: 1.18, label: 'band_5', walkthroughRequired: true },
    { min: 3501, max: Infinity, multiplier: null, label: 'band_6', customOnly: true, walkthroughRequired: true }
  ],

  // Frequency multipliers (non-linear curve)
  // Based on visits per month
  frequencyMultipliers: [
    { maxVisits: 4, multiplier: 1.00 },
    { maxVisits: 8, multiplier: 1.55 },
    { maxVisits: 12, multiplier: 2.05 },
    { maxVisits: 16, multiplier: 2.50 },
    { maxVisits: 20, multiplier: 2.95 },
    { maxVisits: Infinity, multiplier: null, customOnly: true }
  ],

  // Touchpoint scoring (additive, then converted to multiplier)
  // Each touchpoint adds to a score, which becomes a multiplier
  touchpointScores: {
    washroom: 0.06,        // per washroom, cap at 0.24 (4 washrooms max)
    treatment_room: 0.04,  // per room, cap at 0.20 (5 rooms max)
    reception: 0.04,
    kitchen: 0.04,
    high_touch_disinfection: 0.06
  },
  touchpointMax: 0.35,  // Cap total touchpoint score at 0.35 (i.e. max multiplier = 1.35)

  // Complexity factors (additive, then converted to multiplier)
  complexityFactors: {
    flooring: {
      mostly_hard: 0.00,
      mixed: 0.04,
      mostly_carpet: 0.06
    },
    after_hours: 0.06,
    supplies_included: 0.04,  // if true
    urgency: {
      '0-2': 0.06,   // 0-2 days = urgent
      '3-7': 0.03,   // 3-7 days = moderate
      '8+': 0.00     // 8+ days = normal
    }
  },
  complexityMax: 0.20,  // Cap complexity adders at 0.20 (i.e. max multiplier = 1.20)

  // Minimum monthly floors (same as base prices or higher)
  minimumMonthly: {
    commercial_office: 349,
    physio_chiro: 499,
    medical_clinic: 549,
    dental: 529,
    optical: 499,
    industrial: 699,
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
  },

  // Service-specific configurations (overrides defaults above)
  serviceSpecific: {
    commercial_office: {
      // Treatment rooms don't apply to offices - use conference rooms instead
      touchpointScores: {
        washroom: 0.05,
        treatment_room: 0.00,  // Not applicable
        reception: 0.03,
        kitchen: 0.03,
        high_touch_disinfection: 0.04
      },
      touchpointMax: 0.25,
      // Offices can handle larger sqft without walkthrough
      sqftBands: [
        { min: 0, max: 1200, multiplier: 0.92, walkthroughRequired: false },
        { min: 1201, max: 1600, multiplier: 1.00, walkthroughRequired: false },
        { min: 1601, max: 2500, multiplier: 1.08, walkthroughRequired: false },
        { min: 2501, max: 3500, multiplier: 1.15, walkthroughRequired: true }
      ]
    },

    medical_clinic: {
      // Higher treatment room weighting for medical
      touchpointScores: {
        washroom: 0.07,
        treatment_room: 0.06,  // Higher for medical
        reception: 0.05,
        kitchen: 0.04,
        high_touch_disinfection: 0.08  // Critical for medical
      },
      touchpointMax: 0.40,
      // Medical clinics typically benefit from more frequent cleaning
      frequencyMultipliers: [
        { maxVisits: 4, multiplier: 1.00 },
        { maxVisits: 8, multiplier: 1.60 },
        { maxVisits: 12, multiplier: 2.15 },
        { maxVisits: 16, multiplier: 2.65 },
        { maxVisits: 20, multiplier: 3.10 }
      ],
      // Carpet is more expensive to maintain in medical settings
      complexityFactors: {
        flooring: {
          mostly_hard: 0.00,
          mixed: 0.05,
          mostly_carpet: 0.08
        },
        after_hours: 0.07,
        supplies_included: 0.05,
        urgency: {
          '0-2': 0.08,
          '3-7': 0.04,
          '8+': 0.00
        }
      }
    },

    dental: {
      // Highest treatment room weighting (operatories are critical)
      touchpointScores: {
        washroom: 0.07,
        treatment_room: 0.07,  // Highest for dental operatories
        reception: 0.05,
        kitchen: 0.04,
        high_touch_disinfection: 0.08  // Critical
      },
      touchpointMax: 0.40,
      // Dental offices often need higher frequency
      frequencyMultipliers: [
        { maxVisits: 4, multiplier: 1.00 },
        { maxVisits: 8, multiplier: 1.58 },
        { maxVisits: 12, multiplier: 2.12 },
        { maxVisits: 16, multiplier: 2.60 },
        { maxVisits: 20, multiplier: 3.05 }
      ],
      // Carpet is problematic in dental - higher complexity
      complexityFactors: {
        flooring: {
          mostly_hard: 0.00,
          mixed: 0.06,
          mostly_carpet: 0.10  // Higher penalty for dental
        },
        after_hours: 0.07,
        supplies_included: 0.05,
        urgency: {
          '0-2': 0.08,
          '3-7': 0.04,
          '8+': 0.00
        }
      }
    },

    physio_chiro: {
      // Treatment rooms are important but less critical than dental/medical
      touchpointScores: {
        washroom: 0.06,
        treatment_room: 0.05,
        reception: 0.04,
        kitchen: 0.04,
        high_touch_disinfection: 0.07
      },
      touchpointMax: 0.35,
      // Similar to medical but slightly lower
      frequencyMultipliers: [
        { maxVisits: 4, multiplier: 1.00 },
        { maxVisits: 8, multiplier: 1.55 },
        { maxVisits: 12, multiplier: 2.08 },
        { maxVisits: 16, multiplier: 2.55 },
        { maxVisits: 20, multiplier: 3.00 }
      ]
    },

    optical: {
      // Similar to medical but often smaller spaces
      touchpointScores: {
        washroom: 0.06,
        treatment_room: 0.04,
        reception: 0.04,
        kitchen: 0.03,
        high_touch_disinfection: 0.06
      },
      touchpointMax: 0.30,
      // Optical often needs less frequent but thorough cleaning
      frequencyMultipliers: [
        { maxVisits: 4, multiplier: 1.00 },
        { maxVisits: 8, multiplier: 1.52 },
        { maxVisits: 12, multiplier: 2.02 },
        { maxVisits: 16, multiplier: 2.48 },
        { maxVisits: 20, multiplier: 2.90 }
      ]
    },

    industrial: {
      // Industrial spaces scale differently
      touchpointScores: {
        washroom: 0.08,  // Higher for industrial
        treatment_room: 0.00,  // Not applicable
        reception: 0.03,
        kitchen: 0.05,  // Break rooms important
        high_touch_disinfection: 0.04
      },
      touchpointMax: 0.30,
      // Industrial spaces scale differently by sqft
      sqftBands: [
        { min: 0, max: 1200, multiplier: 0.90, walkthroughRequired: false },
        { min: 1201, max: 1600, multiplier: 1.00, walkthroughRequired: false },
        { min: 1601, max: 3000, multiplier: 1.12, walkthroughRequired: true },
        { min: 3001, max: 5000, multiplier: 1.25, walkthroughRequired: true }
      ],
      // Industrial often has unique complexity (hazmat, heavy equipment)
      complexityFactors: {
        flooring: {
          mostly_hard: 0.00,
          mixed: 0.05,
          mostly_carpet: 0.08  // Carpet rare in industrial but expensive if present
        },
        after_hours: 0.05,
        supplies_included: 0.05,
        urgency: {
          '0-2': 0.08,
          '3-7': 0.04,
          '8+': 0.00
        }
      }
    },

    residential_common_area: {
      // Lower touchpoint scores for residential
      touchpointScores: {
        washroom: 0.05,
        treatment_room: 0.00,  // Not applicable
        reception: 0.03,
        kitchen: 0.04,
        high_touch_disinfection: 0.04
      },
      touchpointMax: 0.25,
      // Residential typically lower frequency needs
      frequencyMultipliers: [
        { maxVisits: 4, multiplier: 1.00 },
        { maxVisits: 8, multiplier: 1.50 },
        { maxVisits: 12, multiplier: 2.00 },
        { maxVisits: 16, multiplier: 2.45 },
        { maxVisits: 20, multiplier: 2.85 }
      ]
    }
  }
};

/**
 * Get sqft band for given square footage
 * @param {number} sqft - Square footage
 * @param {string} [serviceType] - Service type for service-specific bands
 * @returns {Object} Band object with multiplier, label, etc.
 */
export function getSqftBand(sqft, serviceType) {
  if (!sqft || sqft <= 0) {
    // Use conservative default (band_1) if sqft missing
    const bands = serviceType && QUOTE_CONFIG.serviceSpecific[serviceType]?.sqftBands 
      ? QUOTE_CONFIG.serviceSpecific[serviceType].sqftBands 
      : QUOTE_CONFIG.sqftBands;
    return bands[0];
  }

  // Use service-specific bands if available
  const bands = serviceType && QUOTE_CONFIG.serviceSpecific[serviceType]?.sqftBands 
    ? QUOTE_CONFIG.serviceSpecific[serviceType].sqftBands 
    : QUOTE_CONFIG.sqftBands;

  // Match band labels from defaults if not specified
  const defaultBands = QUOTE_CONFIG.sqftBands;
  
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    if (sqft >= band.min && sqft <= band.max) {
      // Preserve label from default bands if not specified
      if (!band.label && defaultBands[i]) {
        band.label = defaultBands[i].label;
      }
      return band;
    }
  }

  // Fallback to last band (custom only)
  const lastBand = bands[bands.length - 1];
  if (!lastBand.label && defaultBands[defaultBands.length - 1]) {
    lastBand.label = defaultBands[defaultBands.length - 1].label;
  }
  return lastBand;
}

/**
 * Get frequency multiplier for given visits per month
 * @param {number} visitsPerMonth - Number of visits per month
 * @param {string} [serviceType] - Service type for service-specific multipliers
 * @returns {Object} Multiplier object or null if custom_only
 */
export function getFrequencyMultiplier(visitsPerMonth, serviceType) {
  if (!visitsPerMonth || visitsPerMonth <= 0) {
    visitsPerMonth = 4; // Default to weekly
  }

  // Use service-specific multipliers if available
  const multipliers = serviceType && QUOTE_CONFIG.serviceSpecific[serviceType]?.frequencyMultipliers
    ? QUOTE_CONFIG.serviceSpecific[serviceType].frequencyMultipliers
    : QUOTE_CONFIG.frequencyMultipliers;

  for (const freq of multipliers) {
    if (visitsPerMonth <= freq.maxVisits) {
      return freq;
    }
  }

  // >20 visits = custom only
  return { maxVisits: Infinity, multiplier: null, customOnly: true };
}

/**
 * Get touchpoint scores for service type
 * @param {string} serviceType - Service type
 * @returns {Object} Touchpoint scores config
 */
export function getTouchpointScores(serviceType) {
  if (serviceType && QUOTE_CONFIG.serviceSpecific[serviceType]?.touchpointScores) {
    return QUOTE_CONFIG.serviceSpecific[serviceType].touchpointScores;
  }
  return QUOTE_CONFIG.touchpointScores;
}

/**
 * Get touchpoint max cap for service type
 * @param {string} serviceType - Service type
 * @returns {number} Maximum touchpoint score
 */
export function getTouchpointMax(serviceType) {
  if (serviceType && QUOTE_CONFIG.serviceSpecific[serviceType]?.touchpointMax !== undefined) {
    return QUOTE_CONFIG.serviceSpecific[serviceType].touchpointMax;
  }
  return QUOTE_CONFIG.touchpointMax;
}

/**
 * Get complexity factors for service type
 * @param {string} serviceType - Service type
 * @returns {Object} Complexity factors config
 */
export function getComplexityFactors(serviceType) {
  if (serviceType && QUOTE_CONFIG.serviceSpecific[serviceType]?.complexityFactors) {
    return QUOTE_CONFIG.serviceSpecific[serviceType].complexityFactors;
  }
  return QUOTE_CONFIG.complexityFactors;
}

/**
 * Get complexity max cap for service type
 * @param {string} serviceType - Service type
 * @returns {number} Maximum complexity score
 */
export function getComplexityMax(serviceType) {
  if (serviceType && QUOTE_CONFIG.serviceSpecific[serviceType]?.complexityMax !== undefined) {
    return QUOTE_CONFIG.serviceSpecific[serviceType].complexityMax;
  }
  return QUOTE_CONFIG.complexityMax;
}
