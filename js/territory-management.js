/**
 * Territory Management Module
 * Handles territory CRUD, map drawing, rep assignment, and coverage metrics
 */

import { supabase } from './supabase.js';

// ============================================
// TERRITORY CRUD
// ============================================

/**
 * Create a new territory
 */
export async function createTerritory(territoryData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const territory = {
      name: territoryData.name,
      description: territoryData.description || null,
      color: territoryData.color || '#0D47A1',
      priority: territoryData.priority || 1,
      active: territoryData.active !== undefined ? territoryData.active : true,
      geojson: territoryData.geojson || null,
      polygon_coordinates: territoryData.geojson || null,
      territory_type: territoryData.geojson ? 'polygon' : 'postal_code',
      postal_codes: territoryData.postalCodes || null,
      created_by: user.id
    };

    const { data, error } = await supabase
      .from('territories')
      .insert(territory)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Territory] Error creating territory:', error);
    throw error;
  }
}

/**
 * Update territory
 */
export async function updateTerritory(territoryId, updates) {
  try {
    const { data, error } = await supabase
      .from('territories')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', territoryId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Territory] Error updating territory:', error);
    throw error;
  }
}

/**
 * Delete territory
 */
export async function deleteTerritory(territoryId) {
  try {
    const { error } = await supabase
      .from('territories')
      .delete()
      .eq('id', territoryId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[Territory] Error deleting territory:', error);
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
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Territory] Error fetching territories:', error);
    return [];
  }
}

/**
 * Fetch single territory with assignments
 */
export async function fetchTerritory(territoryId) {
  try {
    // Fetch territory first
    const { data: territory, error: territoryError } = await supabase
      .from('territories')
      .select('*')
      .eq('id', territoryId)
      .single();

    if (territoryError) throw territoryError;
    
    // Fetch assignments separately
    const { data: assignments, error: assignmentsError } = await supabase
      .from('territory_assignments')
      .select('*')
      .eq('territory_id', territoryId);

    if (assignmentsError) throw assignmentsError;
    
    // Fetch user profiles for assignments
    if (assignments && assignments.length > 0) {
      const repIds = assignments.map(a => a.rep_user_id).filter(Boolean);
      if (repIds.length > 0) {
        const { data: reps } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', repIds);
        
        if (reps) {
          const repMap = new Map(reps.map(r => [r.id, r]));
          assignments.forEach(assignment => {
            if (assignment.rep_user_id && repMap.has(assignment.rep_user_id)) {
              assignment.rep = repMap.get(assignment.rep_user_id);
            }
          });
        }
      }
    }
    
    return {
      ...territory,
      territory_assignments: assignments || []
    };
  } catch (error) {
    console.error('[Territory] Error fetching territory:', error);
    throw error;
  }
}

// ============================================
// TERRITORY ASSIGNMENTS
// ============================================

/**
 * Assign rep to territory
 */
export async function assignRepToTerritory(territoryId, repUserId, assignmentData = {}) {
  try {
    const assignment = {
      territory_id: territoryId,
      rep_user_id: repUserId,
      is_primary: assignmentData.isPrimary || false,
      max_stops_per_day: assignmentData.maxStopsPerDay || 30,
      max_drive_minutes_per_day: assignmentData.maxDriveMinutesPerDay || 480,
      shift_start_minutes: assignmentData.shiftStartMinutes || 480,
      shift_end_minutes: assignmentData.shiftEndMinutes || 1080
    };

    const { data, error } = await supabase
      .from('territory_assignments')
      .upsert(assignment, {
        onConflict: 'territory_id,rep_user_id'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Territory] Error assigning rep:', error);
    throw error;
  }
}

/**
 * Unassign rep from territory
 */
export async function unassignRepFromTerritory(territoryId, repUserId) {
  try {
    const { error } = await supabase
      .from('territory_assignments')
      .delete()
      .eq('territory_id', territoryId)
      .eq('rep_user_id', repUserId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[Territory] Error unassigning rep:', error);
    throw error;
  }
}

/**
 * Fetch assignments for a territory
 */
export async function fetchTerritoryAssignments(territoryId) {
  try {
    const { data: assignments, error } = await supabase
      .from('territory_assignments')
      .select('*')
      .eq('territory_id', territoryId);

    if (error) throw error;
    
    // Fetch user profiles for assignments
    if (assignments && assignments.length > 0) {
      const repIds = assignments.map(a => a.rep_user_id).filter(Boolean);
      if (repIds.length > 0) {
        const { data: reps } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', repIds);
        
        if (reps) {
          const repMap = new Map(reps.map(r => [r.id, r]));
          assignments.forEach(assignment => {
            if (assignment.rep_user_id && repMap.has(assignment.rep_user_id)) {
              assignment.rep = repMap.get(assignment.rep_user_id);
            }
          });
        }
      }
    }
    
    return assignments || [];
  } catch (error) {
    console.error('[Territory] Error fetching assignments:', error);
    return [];
  }
}

// ============================================
// TERRITORY MEMBERSHIP (Point in Polygon)
// ============================================

/**
 * Check if a point is inside a territory polygon
 * Uses simple point-in-polygon algorithm (ray casting)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} geojson - GeoJSON polygon
 * @returns {boolean} True if point is inside polygon
 */
export function isPointInTerritory(lat, lng, geojson) {
  if (!geojson || !geojson.coordinates) return false;
  
  // Handle GeoJSON Polygon format: coordinates[0] is the outer ring
  const polygon = geojson.coordinates[0];
  if (!polygon || polygon.length < 3) return false;
  
  let inside = false;
  const x = lng;
  const y = lat;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

/**
 * Find which territory a point belongs to
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Array} territories - Array of territories with geojson
 * @returns {Object|null} Territory or null
 */
export function findTerritoryForPoint(lat, lng, territories) {
  for (const territory of territories) {
    const geojson = territory.geojson || territory.polygon_coordinates;
    if (geojson && isPointInTerritory(lat, lng, geojson)) {
      return territory;
    }
  }
  return null;
}

// ============================================
// COVERAGE METRICS
// ============================================

/**
 * Compute territory coverage metrics
 * @param {string} territoryId - Territory ID
 * @param {Date} dateBucket - Date bucket for metrics
 * @returns {Object} Coverage metrics
 */
export async function computeTerritoryCoverage(territoryId, dateBucket = new Date()) {
  try {
    // Fetch territory
    const territory = await fetchTerritory(territoryId);
    if (!territory) throw new Error('Territory not found');
    
    const geojson = territory.geojson || territory.polygon_coordinates;
    if (!geojson) {
      return {
        totalLeads: 0,
        leadsTouched7d: 0,
        leadsUntouched14d: 0,
        appointments7d: 0,
        pipelineValue: 0,
        coverageScore: 0
      };
    }
    
    // Get territory bounding box for efficient querying
    const bbox = getBoundingBox(geojson);
    
    // Fetch leads in bounding box
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, latitude, longitude, status, last_touched_at, do_not_contact, routing_eligible')
      .gte('latitude', bbox.minLat)
      .lte('latitude', bbox.maxLat)
      .gte('longitude', bbox.minLng)
      .lte('longitude', bbox.maxLng)
      .eq('routing_eligible', true)
      .eq('do_not_contact', false);
    
    if (leadsError) throw leadsError;
    
    // Filter leads that are actually in the polygon
    const leadsInTerritory = (leads || []).filter(lead => {
      if (!lead.latitude || !lead.longitude) return false;
      return isPointInTerritory(lead.latitude, lead.longitude, geojson);
    });
    
    // Calculate metrics
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    
    const leadsTouched7d = leadsInTerritory.filter(lead => {
      if (!lead.last_touched_at) return false;
      return new Date(lead.last_touched_at) >= sevenDaysAgo;
    }).length;
    
    const leadsUntouched14d = leadsInTerritory.filter(lead => {
      if (!lead.last_touched_at) return true;
      return new Date(lead.last_touched_at) < fourteenDaysAgo;
    }).length;
    
    // Fetch appointments in next 7 days
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, lead_id, scheduled_date')
      .gte('scheduled_date', now.toISOString().split('T')[0])
      .lte('scheduled_date', sevenDaysFromNow.toISOString().split('T')[0])
      .eq('status', 'scheduled');
    
    // Count appointments for leads in territory
    const leadIdsInTerritory = new Set(leadsInTerritory.map(l => l.id));
    const appointments7d = (appointments || []).filter(apt => 
      apt.lead_id && leadIdsInTerritory.has(apt.lead_id)
    ).length;
    
    // Calculate pipeline value (if deals/quotes exist)
    // This would need to query deals/quotes table if it exists
    let pipelineValue = 0;
    
    // Calculate coverage score (weighted function)
    const totalLeads = leadsInTerritory.length;
    const touchRate = totalLeads > 0 ? leadsTouched7d / totalLeads : 0;
    const untouchedPenalty = leadsUntouched14d * 0.1;
    const coverageScore = Math.max(0, Math.min(100, 
      (touchRate * 50) + 
      (appointments7d * 10) - 
      untouchedPenalty
    ));
    
    const metrics = {
      totalLeads,
      leadsTouched7d,
      leadsUntouched14d,
      appointments7d,
      pipelineValue,
      coverageScore: Math.round(coverageScore * 10) / 10
    };
    
    // Cache metrics
    const dateBucketStr = dateBucket.toISOString().split('T')[0];
    await supabase
      .from('coverage_cache')
      .upsert({
        territory_id: territoryId,
        date_bucket: dateBucketStr,
        metrics,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'territory_id,date_bucket'
      });
    
    return metrics;
  } catch (error) {
    console.error('[Territory] Error computing coverage:', error);
    throw error;
  }
}

/**
 * Get cached coverage metrics
 */
export async function getCachedCoverage(territoryId, dateBucket = new Date()) {
  try {
    const dateBucketStr = dateBucket.toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('coverage_cache')
      .select('metrics')
      .eq('territory_id', territoryId)
      .eq('date_bucket', dateBucketStr)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    
    return data?.metrics || null;
  } catch (error) {
    console.error('[Territory] Error fetching cached coverage:', error);
    return null;
  }
}

/**
 * Get bounding box from GeoJSON polygon
 */
function getBoundingBox(geojson) {
  if (!geojson || !geojson.coordinates) {
    return { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 };
  }
  
  const polygon = geojson.coordinates[0];
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  
  for (const coord of polygon) {
    const [lng, lat] = coord;
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }
  
  return { minLat, maxLat, minLng, maxLng };
}
