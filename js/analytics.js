// NFG Analytics API Client
// Handles all analytics endpoint calls with RBAC built-in

import { supabase, SUPABASE_URL } from './supabase.js'

const ANALYTICS_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/analytics`

// Helper to get auth token
async function getAuthToken() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) {
    throw new Error('Not authenticated')
  }
  return session.access_token
}

// Generic API call function
async function callAnalyticsEndpoint(endpoint, params = {}) {
  try {
    const token = await getAuthToken()
    
    // Build query string
    const queryParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        queryParams.append(key, value.toString())
      }
    })
    
    const url = `${ANALYTICS_FUNCTION_URL}${endpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    
    const data = await response.json()
    return data.data
  } catch (error) {
    console.error(`Error calling analytics endpoint ${endpoint}:`, error)
    throw error
  }
}

// ============================================
// ANALYTICS API METHODS
// ============================================

/**
 * Get funnel metrics: Calls -> Connections -> Quotes -> Wins
 * @param {Object} filters - { start_date, end_date, user_id, territory, vertical, source }
 * @returns {Promise<Object>} Funnel data with conversion rates
 */
export async function getFunnelMetrics(filters = {}) {
  return callAnalyticsEndpoint('/funnel', filters)
}

/**
 * Get average time to close by vertical
 * @param {Object} filters - { start_date, end_date, user_id }
 * @returns {Promise<Array>} Array of vertical metrics with avg days to close
 */
export async function getTimeToCloseByVertical(filters = {}) {
  return callAnalyticsEndpoint('/time-to-close', filters)
}

/**
 * Get calls per closed deal
 * @param {Object} filters - { start_date, end_date, user_id, territory, vertical }
 * @returns {Promise<Object>} Average calls per deal with breakdown by user
 */
export async function getCallsPerClosedDeal(filters = {}) {
  return callAnalyticsEndpoint('/calls-per-deal', filters)
}

/**
 * Get stalled deals (no touch > X days)
 * @param {Object} filters - { days_without_touch (default 14), user_id, territory, vertical }
 * @returns {Promise<Array>} Array of stalled deals with details
 */
export async function getStalledDeals(filters = {}) {
  return callAnalyticsEndpoint('/stalled-deals', filters)
}

/**
 * Get doors knocked per hour metrics
 * @param {Object} filters - { start_date, end_date, user_id, territory }
 * @returns {Promise<Object>} Overall average and breakdown by user/territory
 */
export async function getDoorsKnockedPerHour(filters = {}) {
  return callAnalyticsEndpoint('/doors-per-hour', filters)
}

/**
 * Get appointments per hour metrics
 * @param {Object} filters - { start_date, end_date, user_id, territory }
 * @returns {Promise<Object>} Overall average and breakdown by user
 */
export async function getAppointmentsPerHour(filters = {}) {
  return callAnalyticsEndpoint('/appointments-per-hour', filters)
}

/**
 * Get conversion rates by territory
 * @param {Object} filters - { start_date, end_date, user_id }
 * @returns {Promise<Array>} Array of territory metrics with conversion rates
 */
export async function getConversionByTerritory(filters = {}) {
  return callAnalyticsEndpoint('/conversion-by-territory', filters)
}

/**
 * Get best time of day for activity
 * @param {Object} filters - { start_date, end_date, user_id, activity_type ('door_knock' | 'appointment' | 'call') }
 * @returns {Promise<Array>} Array of hourly metrics with activity counts and rates
 */
export async function getBestTimeOfDay(filters = {}) {
  return callAnalyticsEndpoint('/best-time-of-day', filters)
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format date for API (YYYY-MM-DD)
 */
export function formatDateForAPI(date) {
  if (!date) return null
  if (typeof date === 'string') return date
  const d = new Date(date)
  return d.toISOString().split('T')[0]
}

/**
 * Get default date range (last 30 days)
 */
export function getDefaultDateRange() {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30)
  
  return {
    start_date: formatDateForAPI(startDate),
    end_date: formatDateForAPI(endDate),
  }
}

/**
 * Format number with commas
 */
export function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  return Number(num).toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/**
 * Format percentage
 */
export function formatPercent(num) {
  if (num === null || num === undefined) return '0%'
  return `${Number(num).toFixed(1)}%`
}

/**
 * Format currency
 */
export function formatCurrency(num) {
  if (num === null || num === undefined) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num)
}

/**
 * Get current user's accessible filters based on role
 */
export async function getAccessibleFilters() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { users: [], territories: [], verticals: [], sources: [] }
    
    // Get user profile to check role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    const isAdmin = profile?.role === 'admin'
    const isManager = profile?.role === 'client' || profile?.role === 'admin'
    
    // Get users (filtered by role)
    let usersQuery = supabase.from('user_profiles').select('id, full_name, email')
    if (!isAdmin && !isManager) {
      usersQuery = usersQuery.eq('id', user.id)
    }
    const { data: users } = await usersQuery.order('full_name')
    
    // Get unique territories, verticals, sources from events
    let eventsQuery = supabase.from('events').select('territory, vertical, source')
    if (!isAdmin && !isManager) {
      eventsQuery = eventsQuery.eq('user_id', user.id)
    }
    const { data: events } = await eventsQuery
    
    const territories = [...new Set(events?.map(e => e.territory).filter(Boolean) || [])].sort()
    const verticals = [...new Set(events?.map(e => e.vertical).filter(Boolean) || [])].sort()
    const sources = [...new Set(events?.map(e => e.source).filter(Boolean) || [])].sort()
    
    return {
      users: users || [],
      territories,
      verticals,
      sources,
      currentUserId: user.id,
      isAdmin,
      isManager,
    }
  } catch (error) {
    console.error('Error getting accessible filters:', error)
    return { users: [], territories: [], verticals: [], sources: [] }
  }
}
