/**
 * RBAC Service - Client-side utilities for role-based access control
 * Provides assertion functions and permission checking utilities
 */

import { supabase } from './supabase.js';

/**
 * Get current user's role
 * @returns {Promise<string>} User role ('admin', 'manager', 'worker', 'rep')
 */
export async function getUserRole() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data?.role || 'worker';
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

/**
 * Check if user has a specific role
 * @param {string|string[]} roles - Role(s) to check
 * @returns {Promise<boolean>}
 */
export async function hasRole(roles) {
  const userRole = await getUserRole();
  if (!userRole) return false;
  
  const roleArray = Array.isArray(roles) ? roles : [roles];
  return roleArray.includes(userRole);
}

/**
 * Assert that user has permission to perform an action
 * @param {string} action - Action to check (e.g., 'deal.read', 'quote.create')
 * @param {object} resource - Resource context (e.g., { type: 'deal', id: '...' })
 * @returns {Promise<boolean>} True if permitted, throws error if not
 * @throws {Error} If permission is denied
 */
export async function assertPermission(action, resource = null) {
  const userRole = await getUserRole();
  if (!userRole) {
    throw new Error('User not authenticated');
  }

  // Admin has all permissions
  if (userRole === 'admin') {
    return true;
  }

  const [resourceType, actionType] = action.split('.');

  // Basic permission checks
  switch (resourceType) {
    case 'deal':
      if (actionType === 'read' || actionType === 'write') {
        // For deals, we need to check assignment
        if (resource?.id) {
          const hasAccess = await checkDealAccess(resource.id, actionType);
          if (!hasAccess) {
            throw new Error(`Permission denied: Cannot ${actionType} deal ${resource.id}`);
          }
        }
        return true;
      }
      break;

    case 'quote':
      if (actionType === 'create') {
        // Reps and managers can create quotes
        return ['worker', 'rep', 'manager'].includes(userRole);
      }
      if (actionType === 'approve') {
        // Only managers and admins can approve
        return ['manager', 'admin'].includes(userRole);
      }
      if (actionType === 'read' || actionType === 'write') {
        // Check quote access based on deal assignment
        return true; // Will be enforced by RLS
      }
      break;

    case 'call':
      if (actionType === 'read' || actionType === 'write') {
        return true; // Enforced by RLS based on deal assignment
      }
      break;

    case 'message':
      if (actionType === 'read' || actionType === 'write') {
        return true; // Enforced by RLS based on conversation participation
      }
      break;

    case 'route':
      if (actionType === 'read' || actionType === 'write') {
        return true; // Enforced by RLS based on assignment
      }
      break;

    case 'audit':
      // Only admins can view audit logs
      if (actionType === 'read') {
        if (userRole !== 'admin') {
          throw new Error('Permission denied: Only admins can view audit logs');
        }
        return true;
      }
      break;
  }

  return true;
}

/**
 * Check if user can access a specific deal
 * @param {string} dealId - Deal ID
 * @param {string} actionType - 'read' or 'write'
 * @returns {Promise<boolean>}
 */
async function checkDealAccess(dealId, actionType) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase.rpc('can_access_deal', {
      user_id_param: user.id,
      deal_id_param: dealId,
      action_type: actionType
    });

    if (error) throw error;
    return data === true;
  } catch (error) {
    console.error('Error checking deal access:', error);
    return false;
  }
}

/**
 * Emit audit log entry
 * @param {string} action - Action name (e.g., 'deal.stage_change')
 * @param {string} targetType - Resource type ('deal', 'quote', etc.)
 * @param {string} targetId - Resource ID
 * @param {object} beforeState - State before action
 * @param {object} afterState - State after action
 * @param {object} metadata - Additional metadata
 */
export async function emitAuditLog(action, targetType, targetId, beforeState = null, afterState = null, metadata = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('Cannot emit audit log: User not authenticated');
      return;
    }

    const { error } = await supabase.rpc('emit_audit_log', {
      action_param: action,
      actor_id_param: user.id,
      target_type_param: targetType,
      target_id_param: targetId,
      before_state_param: beforeState ? JSON.stringify(beforeState) : null,
      after_state_param: afterState ? JSON.stringify(afterState) : null,
      metadata_param: metadata ? JSON.stringify(metadata) : null
    });

    if (error) {
      console.error('Error emitting audit log:', error);
    }
  } catch (error) {
    console.error('Error in emitAuditLog:', error);
  }
}

/**
 * Check if call recording/transcript can be stored (consent check)
 * @param {string} callId - Call ID
 * @param {string} consentType - 'recording' or 'transcript'
 * @returns {Promise<boolean>}
 */
export async function checkCallConsent(callId, consentType) {
  try {
    const { data, error } = await supabase.rpc('check_call_consent', {
      call_id_param: callId,
      consent_type: consentType
    });

    if (error) throw error;
    return data === true;
  } catch (error) {
    console.error('Error checking call consent:', error);
    return false;
  }
}

/**
 * Check if location tracking is allowed for a route
 * @param {string} routeId - Route ID
 * @returns {Promise<boolean>}
 */
export async function checkLocationTrackingAllowed(routeId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase.rpc('check_location_tracking_allowed', {
      route_id_param: routeId,
      user_id_param: user.id
    });

    if (error) throw error;
    return data === true;
  } catch (error) {
    console.error('Error checking location tracking:', error);
    return false;
  }
}

/**
 * Get error message for permission denial
 * @param {Error} error - Error object
 * @returns {string} User-friendly error message
 */
export function getPermissionErrorMessage(error) {
  const message = error.message || String(error);
  
  if (message.includes('consent')) {
    return 'Cannot store recording/transcript: Consent not provided by participant.';
  }
  
  if (message.includes('location')) {
    return 'Location tracking is only allowed during active route sessions.';
  }
  
  if (message.includes('Permission denied')) {
    return message.replace('Permission denied: ', '');
  }
  
  return 'You do not have permission to perform this action.';
}

/**
 * Check if user can perform action (non-throwing version)
 * @param {string} action - Action to check
 * @param {object} resource - Resource context
 * @returns {Promise<{allowed: boolean, error?: string}>}
 */
export async function checkPermission(action, resource = null) {
  try {
    await assertPermission(action, resource);
    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      error: getPermissionErrorMessage(error)
    };
  }
}
