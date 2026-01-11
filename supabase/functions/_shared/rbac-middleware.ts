/**
 * RBAC Middleware for Supabase Edge Functions
 * Provides authentication and authorization checks for API endpoints
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export interface RequestContext {
  user: any
  userRole: string | null
  userId: string | null
}

/**
 * Authenticate request and get user context
 */
export async function authenticateRequest(req: Request): Promise<RequestContext | null> {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return null
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return null
    }

    // Get user role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return null
    }

    return {
      user,
      userRole: profile?.role || null,
      userId: user.id,
    }
  } catch (error) {
    console.error('Authentication error:', error)
    return null
  }
}

/**
 * Check if user has required role(s)
 */
export function hasRole(context: RequestContext, roles: string | string[]): boolean {
  if (!context.userRole) return false
  
  const roleArray = Array.isArray(roles) ? roles : [roles]
  return roleArray.includes(context.userRole)
}

/**
 * Require authentication middleware
 */
export function requireAuth(context: RequestContext | null): RequestContext {
  if (!context) {
    throw new Error('Unauthorized: Authentication required')
  }
  return context
}

/**
 * Require role middleware
 */
export function requireRole(context: RequestContext, roles: string | string[]): void {
  if (!hasRole(context, roles)) {
    const roleList = Array.isArray(roles) ? roles.join(' or ') : roles
    throw new Error(`Forbidden: Requires role: ${roleList}`)
  }
}

/**
 * Check if user can access a resource
 */
export async function checkResourceAccess(
  supabase: any,
  userId: string,
  resourceType: string,
  resourceId: string,
  action: string
): Promise<boolean> {
  try {
    switch (resourceType) {
      case 'deal':
        const { data: dealAccess, error: dealError } = await supabase.rpc('can_access_deal', {
          user_id_param: userId,
          deal_id_param: resourceId,
          action_type: action
        })
        if (dealError) throw dealError
        return dealAccess === true

      case 'quote':
        // Check via deal access
        const { data: quote, error: quoteError } = await supabase
          .from('quotes')
          .select('deal_id, created_by')
          .eq('id', resourceId)
          .single()
        
        if (quoteError || !quote) return false
        
        if (quote.created_by === userId) return true
        
        // Check deal access
        if (quote.deal_id) {
          return await checkResourceAccess(supabase, userId, 'deal', quote.deal_id, action)
        }
        return false

      case 'call':
        // Check via deal access
        const { data: call, error: callError } = await supabase
          .from('calls')
          .select('deal_id, caller_id')
          .eq('id', resourceId)
          .single()
        
        if (callError || !call) return false
        
        if (call.caller_id === userId) return true
        
        if (call.deal_id) {
          return await checkResourceAccess(supabase, userId, 'deal', call.deal_id, action)
        }
        return false

      default:
        return false
    }
  } catch (error) {
    console.error(`Error checking ${resourceType} access:`, error)
    return false
  }
}

/**
 * Check call consent before storing recording/transcript
 */
export async function checkCallConsent(
  supabase: any,
  callId: string,
  consentType: 'recording' | 'transcript'
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_call_consent', {
      call_id_param: callId,
      consent_type: consentType
    })

    if (error) throw error
    return data === true
  } catch (error) {
    console.error('Error checking call consent:', error)
    return false
  }
}

/**
 * Check if location tracking is allowed
 */
export async function checkLocationTrackingAllowed(
  supabase: any,
  routeId: string,
  userId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_location_tracking_allowed', {
      route_id_param: routeId,
      user_id_param: userId
    })

    if (error) throw error
    return data === true
  } catch (error) {
    console.error('Error checking location tracking:', error)
    return false
  }
}

/**
 * Emit audit log entry
 */
export async function emitAuditLog(
  supabase: any,
  action: string,
  actorId: string,
  targetType: string | null = null,
  targetId: string | null = null,
  beforeState: any = null,
  afterState: any = null,
  metadata: any = null
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('emit_audit_log', {
      action_param: action,
      actor_id_param: actorId,
      target_type_param: targetType,
      target_id_param: targetId,
      before_state_param: beforeState ? JSON.stringify(beforeState) : null,
      after_state_param: afterState ? JSON.stringify(afterState) : null,
      metadata_param: metadata ? JSON.stringify(metadata) : null
    })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error emitting audit log:', error)
    return null
  }
}

/**
 * Create error response
 */
export function errorResponse(message: string, status: number = 400): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

/**
 * Create success response
 */
export function successResponse(data: any, status: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

/**
 * Handle CORS preflight
 */
export function handleCORS(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}
