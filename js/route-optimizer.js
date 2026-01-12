/**
 * Route Optimizer Engine
 * In-house route optimization using VRPTW-inspired heuristics
 * No external APIs - pure computation
 */

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_CONFIG = {
  averageSpeedKmh: 35, // Average urban driving speed
  congestionMultipliers: {
    // Time-of-day congestion multipliers (0-23 hours)
    // 1.0 = no congestion, higher = more congestion
    morning: { start: 7, end: 9, multiplier: 1.3 },
    evening: { start: 17, end: 19, multiplier: 1.4 },
    default: 1.0
  },
  latenessPenalty: 100, // Large weight for late arrivals
  overtimePenalty: 200, // Very large weight for overtime
  priorityReward: 10, // Reward for visiting high-priority stops
  maxOptimizationTime: 1000, // Max milliseconds for optimization
  maxIterations: 50, // Max iterations without improvement
  engineVersion: '1.0'
};

// ============================================
// DISTANCE & TRAVEL TIME CALCULATION
// ============================================

/**
 * Calculate Haversine distance between two coordinates (in km)
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate travel time in minutes between two points
 * @param {number} lat1 - Start latitude
 * @param {number} lon1 - Start longitude
 * @param {number} lat2 - End latitude
 * @param {number} lon2 - End longitude
 * @param {number} hourOfDay - Hour of day (0-23) for congestion
 * @param {Object} config - Configuration object
 * @returns {number} Travel time in minutes
 */
export function calculateTravelTime(lat1, lon1, lat2, lon2, hourOfDay = 12, config = DEFAULT_CONFIG) {
  const distance = haversineDistance(lat1, lon1, lat2, lon2);
  
  // Get congestion multiplier for time of day
  let multiplier = config.congestionMultipliers.default;
  if (hourOfDay >= config.congestionMultipliers.morning.start && 
      hourOfDay < config.congestionMultipliers.morning.end) {
    multiplier = config.congestionMultipliers.morning.multiplier;
  } else if (hourOfDay >= config.congestionMultipliers.evening.start && 
             hourOfDay < config.congestionMultipliers.evening.end) {
    multiplier = config.congestionMultipliers.evening.multiplier;
  }
  
  const effectiveSpeed = config.averageSpeedKmh / multiplier;
  const travelTimeHours = distance / effectiveSpeed;
  return Math.round(travelTimeHours * 60); // Convert to minutes
}

/**
 * Build distance matrix for a set of stops
 * @param {Array} stops - Array of stops with lat/lng
 * @param {number} hourOfDay - Hour of day for congestion
 * @param {Object} config - Configuration
 * @returns {Object} Distance matrix { [i]: { [j]: minutes } }
 */
export function buildDistanceMatrix(stops, hourOfDay = 12, config = DEFAULT_CONFIG) {
  const matrix = {};
  for (let i = 0; i < stops.length; i++) {
    matrix[i] = {};
    for (let j = 0; j < stops.length; j++) {
      if (i === j) {
        matrix[i][j] = 0;
      } else {
        matrix[i][j] = calculateTravelTime(
          stops[i].lat,
          stops[i].lng,
          stops[j].lat,
          stops[j].lng,
          hourOfDay,
          config
        );
      }
    }
  }
  return matrix;
}

// ============================================
// STOP SCORING
// ============================================

/**
 * Calculate stop score for ranking
 * @param {Object} stop - Stop object
 * @param {Object} weights - Scoring weights
 * @returns {number} Stop score (higher is better)
 */
export function calculateStopScore(stop, weights = {}) {
  const {
    priorityWeight = 1.0,
    recencyWeight = 0.5,
    valueWeight = 0.3
  } = weights;
  
  let score = 0;
  
  // Priority score (1-5, normalized to 0-1)
  const priorityScore = (stop.priority || 3) / 5;
  score += priorityWeight * priorityScore;
  
  // Recency score (days since last touch, normalized)
  if (stop.daysSinceLastTouch !== undefined) {
    const recencyScore = Math.min(stop.daysSinceLastTouch / 30, 1); // Cap at 30 days
    score += recencyWeight * recencyScore;
  }
  
  // Value score (normalized deal value)
  if (stop.dealValue !== undefined && stop.maxDealValue !== undefined && stop.maxDealValue > 0) {
    const valueScore = stop.dealValue / stop.maxDealValue;
    score += valueWeight * valueScore;
  }
  
  return score;
}

// ============================================
// FEASIBILITY CHECKING
// ============================================

/**
 * Check if a route is feasible given constraints
 * @param {Array} route - Ordered array of stop indices
 * @param {Array} stops - Full array of stops
 * @param {Object} distanceMatrix - Precomputed distance matrix
 * @param {Object} constraints - Route constraints
 * @param {Object} config - Configuration
 * @returns {Object} { feasible: boolean, violations: Array, stats: Object }
 */
export function checkFeasibility(route, stops, distanceMatrix, constraints, config = DEFAULT_CONFIG) {
  const {
    shiftStartMinutes = 480, // 8:00 AM
    shiftEndMinutes = 1080, // 6:00 PM
    lunchBreakStart = 720, // 12:00 PM
    lunchBreakDuration = 30,
    serviceDurationMinutes = 15
  } = constraints;
  
  const violations = [];
  let currentTime = shiftStartMinutes;
  let totalTravelMinutes = 0;
  let totalServiceMinutes = 0;
  let totalLateness = 0;
  let overtime = 0;
  
  for (let i = 0; i < route.length; i++) {
    const stopIdx = route[i];
    const stop = stops[stopIdx];
    
    // Travel time from previous stop
    if (i > 0) {
      const prevStopIdx = route[i - 1];
      const travelTime = distanceMatrix[prevStopIdx][stopIdx];
      totalTravelMinutes += travelTime;
      currentTime += travelTime;
    }
    
    // Check lunch break
    if (currentTime >= lunchBreakStart && currentTime < lunchBreakStart + lunchBreakDuration) {
      currentTime = lunchBreakStart + lunchBreakDuration;
    }
    
    // Check time window
    if (stop.timeWindowStartMinutes !== undefined && stop.timeWindowStartMinutes !== null) {
      if (currentTime < stop.timeWindowStartMinutes) {
        // Wait until window opens
        currentTime = stop.timeWindowStartMinutes;
      }
      if (stop.timeWindowEndMinutes !== undefined && stop.timeWindowEndMinutes !== null) {
        if (currentTime > stop.timeWindowEndMinutes) {
          violations.push({
            stop: stopIdx,
            type: 'time_window_late',
            message: `Stop ${stopIdx} arrives after time window end`
          });
          const lateness = currentTime - stop.timeWindowEndMinutes;
          totalLateness += lateness;
        }
      }
    }
    
    // Service duration
    const serviceDuration = stop.serviceDurationMinutes || serviceDurationMinutes;
    totalServiceMinutes += serviceDuration;
    currentTime += serviceDuration;
    
    // Check shift end
    if (currentTime > shiftEndMinutes) {
      overtime = currentTime - shiftEndMinutes;
      violations.push({
        stop: stopIdx,
        type: 'overtime',
        message: `Route extends beyond shift end by ${overtime} minutes`
      });
    }
  }
  
  const stats = {
    totalTravelMinutes,
    totalServiceMinutes,
    totalTime: currentTime - shiftStartMinutes,
    totalLateness,
    overtime,
    feasibilityScore: violations.length === 0 ? 1 : Math.max(0, 1 - violations.length / route.length)
  };
  
  return {
    feasible: violations.length === 0 && overtime === 0,
    violations,
    stats
  };
}

// ============================================
// OBJECTIVE FUNCTION
// ============================================

/**
 * Calculate route objective value (lower is better)
 * @param {Array} route - Ordered array of stop indices
 * @param {Array} stops - Full array of stops
 * @param {Object} distanceMatrix - Precomputed distance matrix
 * @param {Object} constraints - Route constraints
 * @param {Object} weights - Objective weights
 * @param {Object} config - Configuration
 * @returns {number} Objective value
 */
export function calculateObjective(route, stops, distanceMatrix, constraints, weights = {}, config = DEFAULT_CONFIG) {
  const feasibility = checkFeasibility(route, stops, distanceMatrix, constraints, config);
  
  let objective = feasibility.stats.totalTravelMinutes;
  
  // Add penalties
  objective += config.latenessPenalty * feasibility.stats.totalLateness;
  objective += config.overtimePenalty * feasibility.stats.overtime;
  
  // Subtract rewards for priority stops
  let prioritySum = 0;
  for (const stopIdx of route) {
    prioritySum += stops[stopIdx].priority || 3;
  }
  objective -= config.priorityReward * prioritySum;
  
  return objective;
}

// ============================================
// INITIAL CONSTRUCTION
// ============================================

/**
 * Build initial feasible route using greedy insertion
 * @param {Array} candidateStops - Candidate stops to include
 * @param {Object} startPoint - { lat, lng } starting point
 * @param {Object} constraints - Route constraints
 * @param {Object} weights - Scoring weights
 * @param {Object} config - Configuration
 * @returns {Array} Ordered array of stop indices
 */
export function buildInitialRoute(candidateStops, startPoint, constraints, weights = {}, config = DEFAULT_CONFIG) {
  const {
    shiftStartMinutes = 480,
    shiftEndMinutes = 1080,
    lunchBreakStart = 720,
    lunchBreakDuration = 30,
    maxStops = 50,
    serviceDurationMinutes = 15
  } = constraints;
  
  // Separate must-visit stops (appointments)
  const mustVisit = [];
  const optional = [];
  
  for (let i = 0; i < candidateStops.length; i++) {
    if (candidateStops[i].mustVisit) {
      mustVisit.push(i);
    } else {
      optional.push(i);
    }
  }
  
  // Sort must-visit by time window start
  mustVisit.sort((a, b) => {
    const aStart = candidateStops[a].timeWindowStartMinutes || 0;
    const bStart = candidateStops[b].timeWindowStartMinutes || 0;
    return aStart - bStart;
  });
  
  // Build route starting with must-visit stops
  const route = [];
  let currentLat = startPoint.lat;
  let currentLng = startPoint.lng;
  let currentTime = shiftStartMinutes;
  
  // Add must-visit stops in chronological order
  for (const stopIdx of mustVisit) {
    const stop = candidateStops[stopIdx];
    const travelTime = calculateTravelTime(
      currentLat, currentLng,
      stop.lat, stop.lng,
      Math.floor(currentTime / 60),
      config
    );
    
    currentTime += travelTime;
    
    // Check lunch break
    if (currentTime >= lunchBreakStart && currentTime < lunchBreakStart + lunchBreakDuration) {
      currentTime = lunchBreakStart + lunchBreakDuration;
    }
    
    // Wait for time window if needed
    if (stop.timeWindowStartMinutes !== undefined && currentTime < stop.timeWindowStartMinutes) {
      currentTime = stop.timeWindowStartMinutes;
    }
    
    const serviceDuration = stop.serviceDurationMinutes || serviceDurationMinutes;
    currentTime += serviceDuration;
    
    // Check if feasible
    if (currentTime <= shiftEndMinutes) {
      route.push(stopIdx);
      currentLat = stop.lat;
      currentLng = stop.lng;
    }
  }
  
  // Greedy insertion of optional stops
  const remaining = [...optional];
  remaining.sort((a, b) => {
    const scoreA = calculateStopScore(candidateStops[a], weights);
    const scoreB = calculateStopScore(candidateStops[b], weights);
    return scoreB - scoreA; // Higher score first
  });
  
  while (route.length < maxStops && remaining.length > 0) {
    let bestInsertion = null;
    let bestPosition = -1;
    let bestIncrease = Infinity;
    
    // Try inserting each remaining stop at each position
    for (let i = 0; i < remaining.length; i++) {
      const stopIdx = remaining[i];
      const stop = candidateStops[stopIdx];
      
      for (let pos = 0; pos <= route.length; pos++) {
        // Calculate insertion cost
        let insertionCost = 0;
        
        if (pos === 0) {
          // Insert at start
          insertionCost = calculateTravelTime(
            startPoint.lat, startPoint.lng,
            stop.lat, stop.lng,
            Math.floor(shiftStartMinutes / 60),
            config
          );
          if (route.length > 0) {
            insertionCost += calculateTravelTime(
              stop.lat, stop.lng,
              candidateStops[route[0]].lat, candidateStops[route[0]].lng,
              Math.floor((shiftStartMinutes + insertionCost) / 60),
              config
            );
            insertionCost -= calculateTravelTime(
              startPoint.lat, startPoint.lng,
              candidateStops[route[0]].lat, candidateStops[route[0]].lng,
              Math.floor(shiftStartMinutes / 60),
              config
            );
          }
        } else if (pos === route.length) {
          // Insert at end
          const prevStop = candidateStops[route[pos - 1]];
          insertionCost = calculateTravelTime(
            prevStop.lat, prevStop.lng,
            stop.lat, stop.lng,
            Math.floor(currentTime / 60),
            config
          );
        } else {
          // Insert in middle
          const prevStop = candidateStops[route[pos - 1]];
          const nextStop = candidateStops[route[pos]];
          const originalTravel = calculateTravelTime(
            prevStop.lat, prevStop.lng,
            nextStop.lat, nextStop.lng,
            Math.floor(currentTime / 60),
            config
          );
          const newTravel1 = calculateTravelTime(
            prevStop.lat, prevStop.lng,
            stop.lat, stop.lng,
            Math.floor(currentTime / 60),
            config
          );
          const newTravel2 = calculateTravelTime(
            stop.lat, stop.lng,
            nextStop.lat, nextStop.lng,
            Math.floor((currentTime + newTravel1) / 60),
            config
          );
          insertionCost = (newTravel1 + newTravel2) - originalTravel;
        }
        
        if (insertionCost < bestIncrease) {
          bestInsertion = stopIdx;
          bestPosition = pos;
          bestIncrease = insertionCost;
        }
      }
    }
    
    if (bestInsertion !== null) {
      route.splice(bestPosition, 0, bestInsertion);
      remaining.splice(remaining.indexOf(bestInsertion), 1);
    } else {
      break; // No feasible insertions
    }
  }
  
  return route;
}

// ============================================
// LOCAL OPTIMIZATION
// ============================================

/**
 * 2-opt edge swap improvement
 * @param {Array} route - Current route
 * @param {Array} stops - Full stops array
 * @param {Object} distanceMatrix - Distance matrix
 * @param {Object} constraints - Constraints
 * @param {Object} weights - Weights
 * @param {Object} config - Configuration
 * @returns {Array|null} Improved route or null
 */
function twoOptSwap(route, stops, distanceMatrix, constraints, weights, config) {
  let improved = false;
  let bestRoute = [...route];
  let bestObjective = calculateObjective(route, stops, distanceMatrix, constraints, weights, config);
  
  for (let i = 0; i < route.length - 1; i++) {
    for (let j = i + 2; j < route.length; j++) {
      // Try reversing segment between i and j
      const newRoute = [
        ...route.slice(0, i),
        ...route.slice(i, j + 1).reverse(),
        ...route.slice(j + 1)
      ];
      
      const objective = calculateObjective(newRoute, stops, distanceMatrix, constraints, weights, config);
      if (objective < bestObjective) {
        bestRoute = newRoute;
        bestObjective = objective;
        improved = true;
      }
    }
  }
  
  return improved ? bestRoute : null;
}

/**
 * Or-opt: Move a chain of 1-3 stops to a different position
 * @param {Array} route - Current route
 * @param {Array} stops - Full stops array
 * @param {Object} distanceMatrix - Distance matrix
 * @param {Object} constraints - Constraints
 * @param {Object} weights - Weights
 * @param {Object} config - Configuration
 * @returns {Array|null} Improved route or null
 */
function orOpt(route, stops, distanceMatrix, constraints, weights, config) {
  let bestRoute = [...route];
  let bestObjective = calculateObjective(route, stops, distanceMatrix, constraints, weights, config);
  let improved = false;
  
  // Try moving chains of 1, 2, or 3 stops
  for (let chainLength = 1; chainLength <= Math.min(3, route.length); chainLength++) {
    for (let i = 0; i <= route.length - chainLength; i++) {
      const chain = route.slice(i, i + chainLength);
      const routeWithoutChain = [
        ...route.slice(0, i),
        ...route.slice(i + chainLength)
      ];
      
      // Try inserting chain at each position
      for (let j = 0; j <= routeWithoutChain.length; j++) {
        const newRoute = [
          ...routeWithoutChain.slice(0, j),
          ...chain,
          ...routeWithoutChain.slice(j)
        ];
        
        const objective = calculateObjective(newRoute, stops, distanceMatrix, constraints, weights, config);
        if (objective < bestObjective) {
          bestRoute = newRoute;
          bestObjective = objective;
          improved = true;
        }
      }
    }
  }
  
  return improved ? bestRoute : null;
}

/**
 * Swap two stops
 * @param {Array} route - Current route
 * @param {Array} stops - Full stops array
 * @param {Object} distanceMatrix - Distance matrix
 * @param {Object} constraints - Constraints
 * @param {Object} weights - Weights
 * @param {Object} config - Configuration
 * @returns {Array|null} Improved route or null
 */
function swapStops(route, stops, distanceMatrix, constraints, weights, config) {
  let bestRoute = [...route];
  let bestObjective = calculateObjective(route, stops, distanceMatrix, constraints, weights, config);
  let improved = false;
  
  for (let i = 0; i < route.length; i++) {
    for (let j = i + 1; j < route.length; j++) {
      const newRoute = [...route];
      [newRoute[i], newRoute[j]] = [newRoute[j], newRoute[i]];
      
      const objective = calculateObjective(newRoute, stops, distanceMatrix, constraints, weights, config);
      if (objective < bestObjective) {
        bestRoute = newRoute;
        bestObjective = objective;
        improved = true;
      }
    }
  }
  
  return improved ? bestRoute : null;
}

/**
 * Local optimization with multiple heuristics
 * @param {Array} route - Initial route
 * @param {Array} stops - Full stops array
 * @param {Object} distanceMatrix - Distance matrix
 * @param {Object} constraints - Constraints
 * @param {Object} weights - Weights
 * @param {Object} config - Configuration
 * @returns {Array} Optimized route
 */
export function optimizeRoute(route, stops, distanceMatrix, constraints, weights = {}, config = DEFAULT_CONFIG) {
  const startTime = Date.now();
  let currentRoute = [...route];
  let iterations = 0;
  let noImprovementCount = 0;
  
  while (noImprovementCount < config.maxIterations && 
         (Date.now() - startTime) < config.maxOptimizationTime) {
    iterations++;
    let improved = false;
    
    // Try 2-opt
    const twoOptResult = twoOptSwap(currentRoute, stops, distanceMatrix, constraints, weights, config);
    if (twoOptResult) {
      currentRoute = twoOptResult;
      improved = true;
    }
    
    // Try or-opt
    const orOptResult = orOpt(currentRoute, stops, distanceMatrix, constraints, weights, config);
    if (orOptResult) {
      currentRoute = orOptResult;
      improved = true;
    }
    
    // Try swap
    const swapResult = swapStops(currentRoute, stops, distanceMatrix, constraints, weights, config);
    if (swapResult) {
      currentRoute = swapResult;
      improved = true;
    }
    
    if (improved) {
      noImprovementCount = 0;
    } else {
      noImprovementCount++;
    }
  }
  
  return currentRoute;
}

// ============================================
// MAIN OPTIMIZATION FUNCTION
// ============================================

/**
 * Generate optimized route plan
 * @param {Object} params - Optimization parameters
 * @param {Array} params.stops - Array of candidate stops
 * @param {Object} params.startPoint - { lat, lng } starting point
 * @param {Object} params.constraints - Route constraints
 * @param {Object} params.weights - Scoring weights
 * @param {Object} params.config - Engine configuration
 * @returns {Object} Route plan with stops, schedule, and stats
 */
export function generateRoutePlan({
  stops,
  startPoint,
  constraints = {},
  weights = {},
  config = DEFAULT_CONFIG
}) {
  const startTime = Date.now();
  
  // Validate inputs
  if (!stops || stops.length === 0) {
    return {
      success: false,
      error: 'No stops provided',
      route: [],
      stats: {},
      diagnostics: {}
    };
  }
  
  // Filter eligible stops
  const eligibleStops = stops.filter(stop => {
    if (!stop.lat || !stop.lng) return false;
    if (stop.doNotContact) return false;
    if (stop.routingEligible === false) return false;
    return true;
  });
  
  if (eligibleStops.length === 0) {
    return {
      success: false,
      error: 'No eligible stops found',
      route: [],
      stats: {},
      diagnostics: {
        excluded: stops.length - eligibleStops.length,
        reasons: ['No eligible stops with valid coordinates']
      }
    };
  }
  
  // Build distance matrix
  const hourOfDay = Math.floor((constraints.shiftStartMinutes || 480) / 60);
  const distanceMatrix = buildDistanceMatrix(eligibleStops, hourOfDay, config);
  
  // Build initial route
  let route = buildInitialRoute(eligibleStops, startPoint, constraints, weights, config);
  
  // Optimize route
  route = optimizeRoute(route, eligibleStops, distanceMatrix, constraints, weights, config);
  
  // Calculate schedule
  const schedule = calculateSchedule(route, eligibleStops, distanceMatrix, startPoint, constraints, config);
  
  // Calculate final stats
  const feasibility = checkFeasibility(route, eligibleStops, distanceMatrix, constraints, config);
  const objective = calculateObjective(route, eligibleStops, distanceMatrix, constraints, weights, config);
  
  const excludedStops = eligibleStops
    .map((stop, idx) => ({ stop, idx }))
    .filter(({ idx }) => !route.includes(idx))
    .map(({ stop, idx }) => ({
      stopId: stop.id,
      reason: 'Not selected in optimization'
    }));
  
  const optimizationTime = Date.now() - startTime;
  
  return {
    success: true,
    route: route.map(idx => ({
      stopIndex: idx,
      stop: eligibleStops[idx],
      ...schedule[idx]
    })),
    stats: {
      ...feasibility.stats,
      objective,
      totalStops: route.length,
      excludedStops: excludedStops.length,
      optimizationTimeMs: optimizationTime,
      engineVersion: config.engineVersion
    },
    diagnostics: {
      candidatePoolSize: eligibleStops.length,
      excludedStops,
      iterations: 'N/A', // Could track this in optimizeRoute
      feasibility: feasibility.feasible
    }
  };
}

/**
 * Calculate detailed schedule for route
 * @param {Array} route - Ordered stop indices
 * @param {Array} stops - Full stops array
 * @param {Object} distanceMatrix - Distance matrix
 * @param {Object} startPoint - Starting point
 * @param {Object} constraints - Constraints
 * @param {Object} config - Configuration
 * @returns {Array} Schedule array with timing for each stop
 */
function calculateSchedule(route, stops, distanceMatrix, startPoint, constraints, config) {
  const {
    shiftStartMinutes = 480,
    lunchBreakStart = 720,
    lunchBreakDuration = 30,
    serviceDurationMinutes = 15
  } = constraints;
  
  const schedule = [];
  let currentTime = shiftStartMinutes;
  let currentLat = startPoint.lat;
  let currentLng = startPoint.lng;
  
  for (let i = 0; i < route.length; i++) {
    const stopIdx = route[i];
    const stop = stops[stopIdx];
    
    // Travel time
    const travelTime = calculateTravelTime(
      currentLat, currentLng,
      stop.lat, stop.lng,
      Math.floor(currentTime / 60),
      config
    );
    currentTime += travelTime;
    
    // Lunch break
    if (currentTime >= lunchBreakStart && currentTime < lunchBreakStart + lunchBreakDuration) {
      currentTime = lunchBreakStart + lunchBreakDuration;
    }
    
    // Wait for time window
    const arrivalTime = currentTime;
    if (stop.timeWindowStartMinutes !== undefined && currentTime < stop.timeWindowStartMinutes) {
      currentTime = stop.timeWindowStartMinutes;
    }
    
    const serviceDuration = stop.serviceDurationMinutes || serviceDurationMinutes;
    const startTime = currentTime;
    const endTime = currentTime + serviceDuration;
    currentTime = endTime;
    
    schedule[stopIdx] = {
      orderIndex: i,
      travelMinutesFromPrev: travelTime,
      arrivalTimeMinutes: arrivalTime,
      plannedStartMinutes: startTime,
      plannedEndMinutes: endTime,
      etaMinutesFromShiftStart: startTime - shiftStartMinutes
    };
    
    currentLat = stop.lat;
    currentLng = stop.lng;
  }
  
  return schedule;
}
