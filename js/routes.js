/**
 * Route Management Module
 * Handles route creation, assignment, and management
 */

import { supabase } from './supabase.js';
import { queueOperation, syncOfflineQueue, isOnline } from './offline-sync.js';

// Route statuses
export const ROUTE_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Door outcome types
export const DOOR_OUTCOMES = {
  KNOCKED: 'knocked',
  NO_ANSWER: 'no_answer',
  NOT_INTERESTED: 'not_interested',
  FOLLOW_UP_REQUESTED: 'follow_up_requested',
  DM_NOT_PRESENT: 'dm_not_present',
  APPOINTMENT_SET: 'appointment_set'
};

// Territory types
export const TERRITORY_TYPES = {
  POSTAL_CODE: 'postal_code',
  POLYGON: 'polygon',
  LIST: 'list'
};

/**
 * Create a new territory
 */
export async function createTerritory(territoryData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const territory = {
      name: territoryData.name,
      description: territoryData.description,
      territory_type: territoryData.territory_type,
      postal_codes: territoryData.postal_codes || null,
      polygon_coordinates: territoryData.polygon_coordinates || null,
      created_by: user.id
    };

    if (!isOnline()) {
      return await queueOperation('territories', 'create', territory);
    }

    const { data, error } = await supabase
      .from('territories')
      .insert(territory)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Routes] Error creating territory:', error);
    throw error;
  }
}

/**
 * Fetch all territories
 */
export async function fetchTerritories() {
  try {
    const { data, error } = await supabase
      .from('territories')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Routes] Error fetching territories:', error);
    return [];
  }
}

/**
 * Create a new route
 */
export async function createRoute(routeData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const route = {
      name: routeData.name,
      route_date: routeData.route_date,
      assigned_rep_id: routeData.assigned_rep_id,
      territory_id: routeData.territory_id || null,
      status: ROUTE_STATUS.DRAFT,
      created_by: user.id
    };

    if (!isOnline()) {
      return await queueOperation('routes', 'create', route);
    }

    const { data, error } = await supabase
      .from('routes')
      .insert(route)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Routes] Error creating route:', error);
    throw error;
  }
}

/**
 * Fetch routes (with optional filters)
 */
export async function fetchRoutes(filters = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('routes')
      .select(`
        *,
        territory:territories(*)
      `)
      .order('route_date', { ascending: false });

    // Apply filters
    if (filters.assigned_rep_id) {
      query = query.eq('assigned_rep_id', filters.assigned_rep_id);
    }
    if (filters.route_date) {
      query = query.eq('route_date', filters.route_date);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.date_from) {
      query = query.gte('route_date', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('route_date', filters.date_to);
    }

    const { data, error } = await query;

    if (error) throw error;
    
    // Fetch user profiles for assigned reps
    if (data && data.length > 0) {
      const repIds = [...new Set(data.map(r => r.assigned_rep_id).filter(Boolean))];
      if (repIds.length > 0) {
        const { data: reps } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', repIds);
        
        if (reps) {
          const repMap = new Map(reps.map(r => [r.id, r]));
          data.forEach(route => {
            if (route.assigned_rep_id && repMap.has(route.assigned_rep_id)) {
              route.assigned_rep = repMap.get(route.assigned_rep_id);
            }
          });
        }
      }
    }
    
    return data || [];
  } catch (error) {
    console.error('[Routes] Error fetching routes:', error);
    return [];
  }
}

/**
 * Fetch a single route with details
 */
export async function fetchRoute(routeId) {
  try {
    const { data, error } = await supabase
      .from('routes')
      .select(`
        *,
        territory:territories(*)
      `)
      .eq('id', routeId)
      .single();

    if (error) throw error;
    
    // Fetch user profiles separately if needed
    if (data.assigned_rep_id) {
      const { data: rep } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .eq('id', data.assigned_rep_id)
        .single();
      if (rep) data.assigned_rep = rep;
    }
    
    if (data.created_by) {
      const { data: creator } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .eq('id', data.created_by)
        .single();
      if (creator) data.created_by_user = creator;
    }
    
    return data;
  } catch (error) {
    console.error('[Routes] Error fetching route:', error);
    throw error;
  }
}

/**
 * Update route
 */
export async function updateRoute(routeId, updates) {
  try {
    if (!isOnline()) {
      return await queueOperation('routes', 'update', updates, routeId);
    }

    const { data, error } = await supabase
      .from('routes')
      .update(updates)
      .eq('id', routeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Routes] Error updating route:', error);
    throw error;
  }
}

/**
 * Start route session (explicit user action)
 */
export async function startRoute(routeId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Verify user is assigned to this route
    const route = await fetchRoute(routeId);
    if (route.assigned_rep_id !== user.id) {
      throw new Error('You are not assigned to this route');
    }

    if (route.status !== ROUTE_STATUS.DRAFT) {
      throw new Error('Route must be in draft status to start');
    }

    return await updateRoute(routeId, {
      status: ROUTE_STATUS.ACTIVE,
      started_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Routes] Error starting route:', error);
    throw error;
  }
}

/**
 * Complete route
 */
export async function completeRoute(routeId) {
  try {
    return await updateRoute(routeId, {
      status: ROUTE_STATUS.COMPLETED,
      completed_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Routes] Error completing route:', error);
    throw error;
  }
}

/**
 * Cancel route
 */
export async function cancelRoute(routeId) {
  try {
    return await updateRoute(routeId, {
      status: ROUTE_STATUS.CANCELLED
    });
  } catch (error) {
    console.error('[Routes] Error cancelling route:', error);
    throw error;
  }
}

/**
 * Add door targets to route (bulk import)
 */
export async function addDoorTargets(routeId, targets) {
  try {
    if (!isOnline()) {
      // For offline, queue each target separately
      const operationIds = [];
      for (const target of targets) {
        const opId = await queueOperation('door_targets', 'create', {
          ...target,
          route_id: routeId
        });
        if (opId) operationIds.push(opId);
      }
      return { operationIds };
    }

    const doorTargets = targets.map((target, index) => ({
      route_id: routeId,
      address: target.address,
      address_line_2: target.address_line_2 || null,
      city: target.city || null,
      state_province: target.state_province || null,
      postal_code: target.postal_code || null,
      country: target.country || 'US',
      latitude: target.latitude || null,
      longitude: target.longitude || null,
      property_type: target.property_type || null,
      tags: target.tags || [],
      sequence_order: target.sequence_order || index
    }));

    const { data, error } = await supabase
      .from('door_targets')
      .insert(doorTargets)
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Routes] Error adding door targets:', error);
    throw error;
  }
}

/**
 * Fetch door targets for a route
 */
export async function fetchDoorTargets(routeId, filters = {}) {
  try {
    let query = supabase
      .from('door_targets')
      .select('*')
      .eq('route_id', routeId);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    // Filter out doors in cooldown if requested
    if (filters.exclude_cooldown) {
      query = query.or(`cooldown_until.is.null,cooldown_until.lt.${new Date().toISOString()}`);
    }

    query = query.order('sequence_order', { ascending: true });

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Routes] Error fetching door targets:', error);
    return [];
  }
}

/**
 * Get route progress metrics
 */
export async function getRouteProgress(routeId) {
  try {
    const targets = await fetchDoorTargets(routeId);
    const total = targets.length;
    const visited = targets.filter(t => t.status === 'visited').length;
    const remaining = total - visited;

    return {
      total,
      visited,
      remaining,
      completion_percentage: total > 0 ? Math.round((visited / total) * 100) : 0
    };
  } catch (error) {
    console.error('[Routes] Error getting route progress:', error);
    return { total: 0, visited: 0, remaining: 0, completion_percentage: 0 };
  }
}

/**
 * Get route metrics for manager view
 */
export async function getRouteMetrics(routeId) {
  try {
    const route = await fetchRoute(routeId);
    const targets = await fetchDoorTargets(routeId);
    const visits = await fetchDoorVisits(routeId);

    // Calculate metrics
    const totalDoors = targets.length;
    const visitedDoors = targets.filter(t => t.status === 'visited').length;
    const appointmentsSet = visits.filter(v => v.outcome === DOOR_OUTCOMES.APPOINTMENT_SET).length;
    const followUps = visits.filter(v => v.outcome === DOOR_OUTCOMES.FOLLOW_UP_REQUESTED).length;

    // Calculate time-based metrics
    const routeStartTime = route.started_at ? new Date(route.started_at) : null;
    const now = new Date();
    const hoursElapsed = routeStartTime ? (now - routeStartTime) / (1000 * 60 * 60) : 0;

    const doorsPerHour = hoursElapsed > 0 ? (visitedDoors / hoursElapsed).toFixed(2) : 0;
    const appointmentsPerHour = hoursElapsed > 0 ? (appointmentsSet / hoursElapsed).toFixed(2) : 0;

    return {
      route_id: routeId,
      route_name: route.name,
      route_date: route.route_date,
      total_doors: totalDoors,
      visited_doors: visitedDoors,
      remaining_doors: totalDoors - visitedDoors,
      completion_percentage: totalDoors > 0 ? Math.round((visitedDoors / totalDoors) * 100) : 0,
      appointments_set: appointmentsSet,
      follow_ups_requested: followUps,
      doors_per_hour: parseFloat(doorsPerHour),
      appointments_per_hour: parseFloat(appointmentsPerHour),
      hours_elapsed: hoursElapsed.toFixed(2),
      status: route.status
    };
  } catch (error) {
    console.error('[Routes] Error getting route metrics:', error);
    throw error;
  }
}

/**
 * Fetch door visits for a route
 */
export async function fetchDoorVisits(routeId) {
  try {
    const { data, error } = await supabase
      .from('door_visits')
      .select(`
        *,
        door_target:door_targets(*)
      `)
      .eq('route_id', routeId)
      .order('visited_at', { ascending: false });

    if (error) throw error;
    
    // Fetch user profiles separately if needed
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(v => v.visited_by).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        if (users) {
          const userMap = new Map(users.map(u => [u.id, u]));
          data.forEach(visit => {
            if (visit.visited_by && userMap.has(visit.visited_by)) {
              visit.visited_by_user = userMap.get(visit.visited_by);
            }
          });
        }
      }
    }
    
    return data || [];
  } catch (error) {
    console.error('[Routes] Error fetching door visits:', error);
    return [];
  }
}

/**
 * Record a door visit
 */
export async function recordDoorVisit(visitData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const visit = {
      door_target_id: visitData.door_target_id,
      route_id: visitData.route_id,
      visited_by: user.id,
      visited_at: visitData.visited_at || new Date().toISOString(),
      outcome: visitData.outcome,
      note: visitData.note || null,
      latitude: visitData.latitude || null,
      longitude: visitData.longitude || null
    };

    if (!isOnline()) {
      return await queueOperation('door_visits', 'create', visit);
    }

    const { data, error } = await supabase
      .from('door_visits')
      .insert(visit)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Routes] Error recording door visit:', error);
    throw error;
  }
}

/**
 * Get next door to visit (simple distance-based ordering)
 */
export async function getNextDoor(routeId, currentLat, currentLng) {
  try {
    const targets = await fetchDoorTargets(routeId, {
      status: 'pending',
      exclude_cooldown: true
    });

    if (targets.length === 0) {
      return null;
    }

    // If we have current location, sort by distance
    if (currentLat && currentLng) {
      targets.forEach(target => {
        if (target.latitude && target.longitude) {
          target.distance = calculateDistance(
            currentLat,
            currentLng,
            parseFloat(target.latitude),
            parseFloat(target.longitude)
          );
        } else {
          target.distance = Infinity; // No location data, put at end
        }
      });

      targets.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
    }

    return targets[0];
  } catch (error) {
    console.error('[Routes] Error getting next door:', error);
    return null;
  }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

/**
 * Record route location (privacy-safe, only when route is active)
 */
export async function recordRouteLocation(routeId, location) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Verify route is active and user is assigned
    const route = await fetchRoute(routeId);
    if (route.status !== ROUTE_STATUS.ACTIVE) {
      throw new Error('Can only record location for active routes');
    }
    if (route.assigned_rep_id !== user.id) {
      throw new Error('You are not assigned to this route');
    }

    const locationData = {
      route_id: routeId,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy || null,
      recorded_at: new Date().toISOString()
    };

    if (!isOnline()) {
      // Don't queue location data - it's not critical
      console.log('[Routes] Offline - skipping location recording');
      return null;
    }

    const { data, error } = await supabase
      .from('route_locations')
      .insert(locationData)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Routes] Error recording route location:', error);
    // Don't throw - location tracking is non-critical
    return null;
  }
}

/**
 * Stop location tracking (when route is stopped)
 */
export function stopLocationTracking() {
  // Location tracking is automatically stopped when route status changes
  // This is a placeholder for any cleanup needed
  console.log('[Routes] Location tracking stopped');
}
