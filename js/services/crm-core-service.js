/**
 * Core Sales CRM Service
 * Minimal helper functions for Leads, Contacts, Deals, Quotes, Calls, Messages, Tasks, Sequences, Routes, Doors, and Events
 */

import { supabase } from '../supabase.js'

// ============================================
// EVENT SERVICE
// ============================================

/**
 * Emit an event to the immutable event log
 * @param {Object} params
 * @param {string} params.eventType - Event type (e.g., 'deal.created', 'call.logged')
 * @param {string} params.entityType - Entity type ('lead', 'deal', 'contact', etc.)
 * @param {string} params.entityId - Entity UUID
 * @param {string} params.actorType - Actor type ('user', 'system', 'customer', 'automation')
 * @param {string} [params.actorId] - Actor UUID (optional)
 * @param {Object} [params.payload] - Additional event data
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function emitEvent({ eventType, entityType, entityId, actorType, actorId = null, payload = {} }) {
  try {
    const { data, error } = await supabase.rpc('emit_event', {
      p_event_type: eventType,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_actor_type: actorType,
      p_actor_id: actorId,
      p_payload: payload
    })
    
    if (error) throw error
    
    return { data, error: null }
  } catch (error) {
    console.error('Error emitting event:', error)
    return { data: null, error }
  }
}

/**
 * Get events for an entity
 * @param {string} entityType - Entity type
 * @param {string} entityId - Entity UUID
 * @param {number} [limit=50] - Max events to return
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getEntityEvents(entityType, entityId, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('timestamp', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching entity events:', error)
    return { data: null, error }
  }
}

// ============================================
// LEADS SERVICE
// ============================================

/**
 * Create a new lead
 * @param {Object} leadData - Lead data
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function createLead(leadData) {
  try {
    const { data, error } = await supabase
      .from('leads')
      .insert([leadData])
      .select()
      .single()
    
    if (error) throw error
    
    // Emit event
    await emitEvent({
      eventType: 'lead.created',
      entityType: 'lead',
      entityId: data.id,
      actorType: 'user',
      payload: { lead: data }
    })
    
    return { data, error: null }
  } catch (error) {
    console.error('Error creating lead:', error)
    return { data: null, error }
  }
}

/**
 * Get leads for workspace with pagination
 * @param {string} workspaceId - Workspace UUID
 * @param {Object} [options] - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=50] - Items per page
 * @param {string} [options.status] - Filter by status
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getLeads(workspaceId, options = {}) {
  try {
    const { page = 1, limit = 50, status } = options
    const from = (page - 1) * limit
    const to = from + limit - 1
    
    let query = supabase
      .from('leads')
      .select('*, primary_contact:contacts(*)', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .range(from, to)
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data, error, count } = await query
    
    if (error) throw error
    
    return { data, count, error: null }
  } catch (error) {
    console.error('Error fetching leads:', error)
    return { data: null, count: 0, error }
  }
}

// ============================================
// CONTACTS SERVICE
// ============================================

/**
 * Create or find contact by phone/email (deduplication)
 * @param {Object} contactData - Contact data
 * @returns {Promise<{data: Object|null, error: Error|null, isNew: boolean}>}
 */
export async function createOrFindContact(contactData) {
  try {
    const { normalized_phone, email, workspace_id } = contactData
    
    // Try to find existing contact
    let query = supabase
      .from('contacts')
      .select('*')
      .eq('workspace_id', workspace_id)
    
    if (normalized_phone) {
      query = query.eq('normalized_phone', normalized_phone)
    } else if (email) {
      query = query.eq('email', email)
    } else {
      throw new Error('Contact must have phone or email')
    }
    
    const { data: existing, error: findError } = await query.single()
    
    if (existing && !findError) {
      // Update existing contact
      const { data, error } = await supabase
        .from('contacts')
        .update(contactData)
        .eq('id', existing.id)
        .select()
        .single()
      
      if (error) throw error
      
      return { data, error: null, isNew: false }
    }
    
    // Create new contact
    const { data, error } = await supabase
      .from('contacts')
      .insert([contactData])
      .select()
      .single()
    
    if (error) throw error
    
    await emitEvent({
      eventType: 'contact.created',
      entityType: 'contact',
      entityId: data.id,
      actorType: 'user',
      payload: { contact: data }
    })
    
    return { data, error: null, isNew: true }
  } catch (error) {
    console.error('Error creating/finding contact:', error)
    return { data: null, error, isNew: false }
  }
}

/**
 * Normalize phone number to E.164 format
 * @param {string} phone - Phone number in any format
 * @returns {string} - E.164 formatted phone number
 */
export function normalizePhone(phone) {
  if (!phone) return null
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  
  // If starts with 1 and is 11 digits, assume US number
  if (digits.length === 11 && digits[0] === '1') {
    return `+${digits}`
  }
  
  // If 10 digits, assume US number and add +1
  if (digits.length === 10) {
    return `+1${digits}`
  }
  
  // Otherwise, add + if not present
  return phone.startsWith('+') ? phone : `+${digits}`
}

// ============================================
// DEALS SERVICE
// ============================================

/**
 * Update deal stage and auto-emit event
 * @param {string} dealId - Deal UUID
 * @param {string} newStage - New stage enum
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function updateDealStage(dealId, newStage) {
  try {
    // Get current deal
    const { data: currentDeal, error: fetchError } = await supabase
      .from('deals')
      .select('*')
      .eq('id', dealId)
      .single()
    
    if (fetchError) throw fetchError
    
    // Update deal
    const { data, error } = await supabase
      .from('deals')
      .update({ 
        stage: newStage,
        updated_at: new Date().toISOString()
      })
      .eq('id', dealId)
      .select()
      .single()
    
    if (error) throw error
    
    // Event is auto-emitted via trigger, but we can also emit here if needed
    await emitEvent({
      eventType: 'deal.stage_changed',
      entityType: 'deal',
      entityId: dealId,
      actorType: 'user',
      payload: {
        old_stage: currentDeal.stage,
        new_stage: newStage,
        deal: data
      }
    })
    
    return { data, error: null }
  } catch (error) {
    console.error('Error updating deal stage:', error)
    return { data: null, error }
  }
}

/**
 * Close deal as won
 * @param {string} dealId - Deal UUID
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function closeDealWon(dealId) {
  try {
    const { data, error } = await supabase
      .from('deals')
      .update({
        stage: 'closed_won',
        won_at: new Date().toISOString(),
        lost_at: null,
        lost_reason: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', dealId)
      .select()
      .single()
    
    if (error) throw error
    
    return { data, error: null }
  } catch (error) {
    console.error('Error closing deal as won:', error)
    return { data: null, error }
  }
}

/**
 * Close deal as lost
 * @param {string} dealId - Deal UUID
 * @param {string} lostReason - Lost reason enum
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function closeDealLost(dealId, lostReason) {
  try {
    const { data, error } = await supabase
      .from('deals')
      .update({
        stage: 'closed_lost',
        lost_at: new Date().toISOString(),
        won_at: null,
        lost_reason: lostReason,
        updated_at: new Date().toISOString()
      })
      .eq('id', dealId)
      .select()
      .single()
    
    if (error) throw error
    
    return { data, error: null }
  } catch (error) {
    console.error('Error closing deal as lost:', error)
    return { data: null, error }
  }
}

// ============================================
// CALLS SERVICE (Quo Integration)
// ============================================

/**
 * Create or update call from Quo webhook (idempotent)
 * @param {Object} callData - Call data from Quo
 * @returns {Promise<{data: Object|null, error: Error|null, isNew: boolean}>}
 */
export async function upsertCallFromQuo(callData) {
  try {
    const { quo_call_id } = callData
    
    if (!quo_call_id) {
      throw new Error('quo_call_id is required')
    }
    
    // Check if call exists
    const { data: existing, error: findError } = await supabase
      .from('calls')
      .select('*')
      .eq('quo_call_id', quo_call_id)
      .single()
    
    if (existing && !findError) {
      // Update existing call
      const { data, error } = await supabase
        .from('calls')
        .update(callData)
        .eq('id', existing.id)
        .select()
        .single()
      
      if (error) throw error
      
      await emitEvent({
        eventType: 'call.updated',
        entityType: 'call',
        entityId: data.id,
        actorType: 'system',
        payload: { call: data }
      })
      
      return { data, error: null, isNew: false }
    }
    
    // Create new call
    const { data, error } = await supabase
      .from('calls')
      .insert([callData])
      .select()
      .single()
    
    if (error) throw error
    
    await emitEvent({
      eventType: 'call.created',
      entityType: 'call',
      entityId: data.id,
      actorType: 'system',
      payload: { call: data }
    })
    
    return { data, error: null, isNew: true }
  } catch (error) {
    console.error('Error upserting call from Quo:', error)
    return { data: null, error, isNew: false }
  }
}

/**
 * Link call to deal by phone number matching
 * @param {string} callId - Call UUID
 * @param {string} phoneNumber - Phone number to match
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function linkCallToDeal(callId, phoneNumber) {
  try {
    // Find deal by contact phone
    const normalizedPhone = normalizePhone(phoneNumber)
    
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, lead_id')
      .eq('normalized_phone', normalizedPhone)
      .limit(1)
      .single()
    
    if (contactError || !contact) {
      return { data: null, error: new Error('No matching contact found') }
    }
    
    // Find deal from lead
    let dealId = null
    if (contact.lead_id) {
      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .select('id')
        .eq('lead_id', contact.lead_id)
        .limit(1)
        .single()
      
      if (!dealError && deal) {
        dealId = deal.id
      }
    }
    
    // Update call with link
    const { data, error } = await supabase
      .from('calls')
      .update({
        deal_id: dealId,
        lead_id: contact.lead_id
      })
      .eq('id', callId)
      .select()
      .single()
    
    if (error) throw error
    
    return { data, error: null }
  } catch (error) {
    console.error('Error linking call to deal:', error)
    return { data: null, error }
  }
}

// ============================================
// QUOTES SERVICE
// ============================================

/**
 * Create new quote version
 * @param {string} dealId - Deal UUID
 * @param {string} [baseQuoteId] - Base quote ID to copy from (optional)
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function createQuoteVersion(dealId, baseQuoteId = null) {
  try {
    const { data, error } = await supabase.rpc('create_quote_version', {
      p_deal_id: dealId,
      p_base_quote_id: baseQuoteId
    })
    
    if (error) throw error
    
    await emitEvent({
      eventType: 'quote.created',
      entityType: 'quote',
      entityId: data,
      actorType: 'user',
      payload: { deal_id: dealId, base_quote_id: baseQuoteId }
    })
    
    return { data, error: null }
  } catch (error) {
    console.error('Error creating quote version:', error)
    return { data: null, error }
  }
}

// ============================================
// ROUTES SERVICE
// ============================================

/**
 * Get active routes for user
 * @param {string} userId - User UUID
 * @param {Date} [routeDate] - Specific date (defaults to today)
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getActiveRoutesForUser(userId, routeDate = null) {
  try {
    const date = routeDate || new Date().toISOString().split('T')[0]
    
    const { data, error } = await supabase
      .from('routes')
      .select('*, territory:territories(*), door_visits:door_visits(*)')
      .eq('assigned_user_id', userId)
      .eq('route_date', date)
      .in('status', ['planned', 'in_progress'])
      .order('route_date', { ascending: true })
    
    if (error) throw error
    
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching active routes:', error)
    return { data: null, error }
  }
}

/**
 * Start route (update status and started_at)
 * @param {string} routeId - Route UUID
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function startRoute(routeId) {
  try {
    const { data, error } = await supabase
      .from('routes')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', routeId)
      .select()
      .single()
    
    if (error) throw error
    
    await emitEvent({
      eventType: 'route.started',
      entityType: 'route',
      entityId: routeId,
      actorType: 'user',
      payload: { route: data }
    })
    
    return { data, error: null }
  } catch (error) {
    console.error('Error starting route:', error)
    return { data: null, error }
  }
}

// ============================================
// SEQUENCES SERVICE
// ============================================

/**
 * Start sequence execution for deal
 * @param {string} sequenceId - Sequence UUID
 * @param {string} dealId - Deal UUID
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function startSequenceForDeal(sequenceId, dealId) {
  try {
    const { data, error } = await supabase
      .from('sequence_executions')
      .insert([{
        sequence_id: sequenceId,
        deal_id: dealId,
        status: 'active',
        current_step: 0,
        attempt_count: 0,
        next_execution_at: new Date().toISOString()
      }])
      .select()
      .single()
    
    if (error) throw error
    
    await emitEvent({
      eventType: 'sequence.started',
      entityType: 'deal',
      entityId: dealId,
      actorType: 'automation',
      payload: { sequence_id: sequenceId, execution_id: data.id }
    })
    
    return { data, error: null }
  } catch (error) {
    console.error('Error starting sequence:', error)
    return { data: null, error }
  }
}

// ============================================
// ENUM HELPERS
// ============================================

/**
 * Get available enum values (cached)
 */
const enumCache = {}

export async function getEnumValues(enumName) {
  if (enumCache[enumName]) {
    return enumCache[enumName]
  }
  
  try {
    const functionName = `get_${enumName}_values` || `get_${enumName}`
    const { data, error } = await supabase.rpc(functionName)
    
    if (error) throw error
    
    enumCache[enumName] = data
    return data
  } catch (error) {
    console.error(`Error fetching enum values for ${enumName}:`, error)
    return []
  }
}

// Export all functions
export default {
  // Events
  emitEvent,
  getEntityEvents,
  
  // Leads
  createLead,
  getLeads,
  
  // Contacts
  createOrFindContact,
  normalizePhone,
  
  // Deals
  updateDealStage,
  closeDealWon,
  closeDealLost,
  
  // Calls
  upsertCallFromQuo,
  linkCallToDeal,
  
  // Quotes
  createQuoteVersion,
  
  // Routes
  getActiveRoutesForUser,
  startRoute,
  
  // Sequences
  startSequenceForDeal,
  
  // Enums
  getEnumValues
}
