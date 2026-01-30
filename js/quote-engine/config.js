/**
 * Quote Engine Configuration
 * Admin-editable pricing rules and multipliers
 * Update these values to adjust pricing without touching core calculation logic
 */

export const QUOTE_CONFIG = {
  // Base monthly prices (ex-HST) for 4 visits/mo, 1200-1600 sqft band (baseline)
  basePrices: {
    // Commercial
    commercial_office: 349,
    industrial: 699,
    restaurant: 599,
    // Healthcare
    physio_chiro: 499,
    medical_clinic: 549,
    dental: 529,
    optical: 499,
    // Residential
    residential_home: 179,           // Per visit for recurring, monthly = visits × this
    residential_common_area: 499,
    // Real Estate
    realtor: 249,                    // Base per-clean price (one-time jobs)
    property_manager: 199            // Base per-unit turnover price
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
    // Commercial
    commercial_office: 349,
    industrial: 699,
    restaurant: 599,
    // Healthcare
    physio_chiro: 499,
    medical_clinic: 549,
    dental: 529,
    optical: 499,
    // Residential
    residential_home: 149,
    residential_common_area: 499,
    // Real Estate
    realtor: 199,
    property_manager: 149
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
      // Lower touchpoint scores for residential common areas
      touchpointScores: {
        washroom: 0.05,
        treatment_room: 0.02,  // Elevators count as touchpoints
        reception: 0.04,  // Lobby
        kitchen: 0.03,  // Party room/kitchen
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
      ],
      // Condo/apartment common areas scale by floors/size
      sqftBands: [
        { min: 0, max: 1500, multiplier: 0.90, walkthroughRequired: false },
        { min: 1501, max: 2500, multiplier: 1.00, walkthroughRequired: false },
        { min: 2501, max: 4000, multiplier: 1.15, walkthroughRequired: true },
        { min: 4001, max: 6000, multiplier: 1.30, walkthroughRequired: true },
        { min: 6001, max: 10000, multiplier: 1.50, walkthroughRequired: true }
      ],
      complexityFactors: {
        flooring: {
          mostly_hard: 0.00,
          mixed: 0.03,
          mostly_carpet: 0.05
        },
        after_hours: 0.03,
        supplies_included: 0.04,
        urgency: {
          '0-2': 0.05,
          '3-7': 0.02,
          '8+': 0.00
        }
      },
      complexityMax: 0.20
    },

    restaurant: {
      // Kitchen is critical for restaurants - higher weighting
      touchpointScores: {
        washroom: 0.08,  // Higher - customer-facing and staff washrooms
        treatment_room: 0.00,  // Not applicable
        reception: 0.03,  // Host stand
        kitchen: 0.08,  // Critical - grease, food prep areas
        high_touch_disinfection: 0.08  // Critical - tables, chairs, menus, POS systems
      },
      touchpointMax: 0.40,
      // Restaurants often need frequent cleaning (daily or multiple times per week)
      frequencyMultipliers: [
        { maxVisits: 4, multiplier: 1.00 },
        { maxVisits: 8, multiplier: 1.62 },
        { maxVisits: 12, multiplier: 2.18 },
        { maxVisits: 16, multiplier: 2.68 },
        { maxVisits: 20, multiplier: 3.15 }
      ],
      // Higher complexity for grease, food residue, and after-hours cleaning
      complexityFactors: {
        flooring: {
          mostly_hard: 0.00,
          mixed: 0.06,  // Higher - grease on mixed surfaces
          mostly_carpet: 0.10  // Carpet in restaurants is problematic
        },
        after_hours: 0.08,  // Higher - after-hours cleaning is common
        supplies_included: 0.05,
        urgency: {
          '0-2': 0.08,
          '3-7': 0.04,
          '8+': 0.00
        }
      },
      complexityMax: 0.25,
      // Restaurants may need walkthroughs earlier due to kitchen complexity
      sqftBands: [
        { min: 0, max: 1200, multiplier: 0.92, walkthroughRequired: false },
        { min: 1201, max: 1600, multiplier: 1.00, walkthroughRequired: false },
        { min: 1601, max: 2200, multiplier: 1.10, walkthroughRequired: true },
        { min: 2201, max: 3000, multiplier: 1.20, walkthroughRequired: true }
      ]
    },

    residential_home: {
      // Residential homes - bedrooms/bathrooms are primary factors
      touchpointScores: {
        washroom: 0.07,  // Bathrooms are key
        treatment_room: 0.04,  // Bedrooms
        reception: 0.00,  // Not applicable
        kitchen: 0.06,  // Kitchen is significant
        high_touch_disinfection: 0.03
      },
      touchpointMax: 0.30,
      // Residential cleaning typically bi-weekly or weekly
      frequencyMultipliers: [
        { maxVisits: 2, multiplier: 0.85 },   // Bi-weekly
        { maxVisits: 4, multiplier: 1.00 },   // Weekly
        { maxVisits: 8, multiplier: 1.85 },   // Twice weekly
        { maxVisits: 12, multiplier: 2.60 }   // 3x weekly
      ],
      // Residential sqft bands
      sqftBands: [
        { min: 0, max: 1000, multiplier: 0.85, walkthroughRequired: false },
        { min: 1001, max: 1500, multiplier: 1.00, walkthroughRequired: false },
        { min: 1501, max: 2200, multiplier: 1.15, walkthroughRequired: false },
        { min: 2201, max: 3000, multiplier: 1.30, walkthroughRequired: false },
        { min: 3001, max: 4500, multiplier: 1.50, walkthroughRequired: true }
      ],
      complexityFactors: {
        flooring: {
          mostly_hard: 0.00,
          mixed: 0.03,
          mostly_carpet: 0.05
        },
        after_hours: 0.00,  // Not typically applicable
        supplies_included: 0.04,
        urgency: {
          '0-2': 0.05,
          '3-7': 0.02,
          '8+': 0.00
        }
      }
    },

    realtor: {
      // Realtor move-in/move-out - one-time deep cleans
      touchpointScores: {
        washroom: 0.08,  // Bathrooms critical for showings
        treatment_room: 0.04,  // Bedrooms
        reception: 0.00,  // Not applicable
        kitchen: 0.08,  // Appliance cleaning often required
        high_touch_disinfection: 0.04
      },
      touchpointMax: 0.35,
      // One-time jobs - frequency less relevant, but can handle recurring turnovers
      frequencyMultipliers: [
        { maxVisits: 1, multiplier: 1.00 },   // One-time
        { maxVisits: 2, multiplier: 1.90 },   // Two jobs/month
        { maxVisits: 4, multiplier: 3.60 },   // Four jobs/month
        { maxVisits: 8, multiplier: 6.80 }    // High volume realtor
      ],
      // Realtor sqft bands
      sqftBands: [
        { min: 0, max: 1000, multiplier: 0.80, walkthroughRequired: false },
        { min: 1001, max: 1500, multiplier: 1.00, walkthroughRequired: false },
        { min: 1501, max: 2200, multiplier: 1.20, walkthroughRequired: false },
        { min: 2201, max: 3000, multiplier: 1.40, walkthroughRequired: true },
        { min: 3001, max: 5000, multiplier: 1.70, walkthroughRequired: true }
      ],
      // Deep cleans have higher complexity
      complexityFactors: {
        flooring: {
          mostly_hard: 0.00,
          mixed: 0.04,
          mostly_carpet: 0.08
        },
        after_hours: 0.00,
        supplies_included: 0.05,
        urgency: {
          '0-2': 0.10,  // Rush jobs common for closings
          '3-7': 0.05,
          '8+': 0.00
        }
      },
      complexityMax: 0.30
    },

    property_manager: {
      // Property managers - volume-based pricing
      touchpointScores: {
        washroom: 0.06,
        treatment_room: 0.03,  // Bedrooms per unit
        reception: 0.02,  // Common areas/lobby
        kitchen: 0.05,
        high_touch_disinfection: 0.03
      },
      touchpointMax: 0.25,
      // Volume discounts for multiple units
      frequencyMultipliers: [
        { maxVisits: 2, multiplier: 1.00 },   // 1-2 turnovers
        { maxVisits: 4, multiplier: 1.80 },   // 3-4 turnovers
        { maxVisits: 8, multiplier: 3.20 },   // 5-8 turnovers
        { maxVisits: 12, multiplier: 4.50 },  // 9-12 turnovers
        { maxVisits: 20, multiplier: 7.00 }   // High volume
      ],
      // Property manager sqft bands (per unit average)
      sqftBands: [
        { min: 0, max: 800, multiplier: 0.85, walkthroughRequired: false },
        { min: 801, max: 1200, multiplier: 1.00, walkthroughRequired: false },
        { min: 1201, max: 1800, multiplier: 1.18, walkthroughRequired: false },
        { min: 1801, max: 2500, multiplier: 1.35, walkthroughRequired: true }
      ],
      complexityFactors: {
        flooring: {
          mostly_hard: 0.00,
          mixed: 0.03,
          mostly_carpet: 0.06
        },
        after_hours: 0.00,
        supplies_included: 0.04,
        urgency: {
          '0-2': 0.08,  // Quick turnovers needed
          '3-7': 0.03,
          '8+': 0.00
        }
      },
      complexityMax: 0.22
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
