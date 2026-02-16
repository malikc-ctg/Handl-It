// ============================================
// Event Service - Immutable Event Logging
// ============================================

import { supabase } from '../supabase.js';

/**
 * Create a deal event (immutable log)
 * 
 * @param {{ deal_id: string; event_type: string; user_id?: string; old_value?: any; new_value?: any; metadata?: any }} eventData - Event data
 * @returns {Promise<Object>} Created event
 */
export async function createDealEvent(eventData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('deal_events')
      .insert({
        deal_id: eventData.deal_id,
        event_type: eventData.event_type,
        user_id: (eventData && eventData.user_id) || user.id,
        old_value: eventData.old_value || null,
        new_value: eventData.new_value || null,
        metadata: eventData.metadata || {},
        created_at: new Date().toISOString() // Explicit timestamp for immutability
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('[Event Service] Error creating event:', error);
    throw error;
  }
}

/**
 * Log a call event
 * 
 * @param {Object} callData - Call data
 * @returns {Promise<Object>} Created call and event
 */
export async function logCall(callData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    // Create call record
    const { data: call, error: callError } = await supabase
      .from('calls')
      .insert({
        ...callData,
        user_id: callData.user_id || user.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (callError) throw callError;
    
    // Create event
    await createDealEvent({
      deal_id: callData.deal_id,
      event_type: 'call_logged',
      new_value: {
        call_id: call.id,
        duration: call.duration_seconds,
        outcome: call.outcome
      }
    });
    
    // Update deal last_touch_at
    const { data: currentDeal } = await supabase
      .from('deals')
      .select('touch_count')
      .eq('id', callData.deal_id)
      .single();
    
    await supabase
      .from('deals')
      .update({
        last_touch_at: new Date().toISOString(),
        touch_count: (currentDeal?.touch_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', callData.deal_id);
    
    return call;
  } catch (error) {
    console.error('[Event Service] Error logging call:', error);
    throw error;
  }
}

/**
 * Log a door visit
 * 
 * @param {Object} visitData - Visit data
 * @returns {Promise<Object>} Created visit and event
 */
export async function logDoorVisit(visitData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    // Create visit record
    const { data: visit, error: visitError } = await supabase
      .from('door_visits')
      .insert({
        ...visitData,
        user_id: visitData.user_id || user.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (visitError) throw visitError;
    
    // Create event
    await createDealEvent({
      deal_id: visitData.deal_id,
      event_type: 'door_visit_logged',
      new_value: {
        visit_id: visit.id,
        visit_date: visit.visit_date,
        outcome: visit.outcome
      }
    });
    
    // Update deal last_touch_at
    const { data: currentDeal } = await supabase
      .from('deals')
      .select('touch_count')
      .eq('id', visitData.deal_id)
      .single();
    
    await supabase
      .from('deals')
      .update({
        last_touch_at: new Date().toISOString(),
        touch_count: (currentDeal?.touch_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', visitData.deal_id);
    
    return visit;
  } catch (error) {
    console.error('[Event Service] Error logging door visit:', error);
    throw error;
  }
}

/**
 * Log a message (sales context)
 * 
 * @param {Object} messageData - Message data
 * @returns {Promise<Object>} Created message and event
 */
export async function logMessage(messageData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    // Create message record
    const { data: message, error: messageError } = await supabase
      .from('deal_messages')
      .insert({
        ...messageData,
        user_id: messageData.user_id || user.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (messageError) throw messageError;
    
    // Create event
    await createDealEvent({
      deal_id: messageData.deal_id,
      event_type: messageData.direction === 'inbound' ? 'message_received' : 'message_sent',
      new_value: {
        message_id: message.id,
        channel: message.channel,
        direction: message.direction
      }
    });
    
    // Update deal last_touch_at (only for outbound)
    if (messageData.direction === 'outbound') {
      const { data: currentDeal } = await supabase
        .from('deals')
        .select('touch_count')
        .eq('id', messageData.deal_id)
        .single();
      
      await supabase
        .from('deals')
        .update({
          last_touch_at: new Date().toISOString(),
          touch_count: (currentDeal?.touch_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageData.deal_id);
    }
    
    return message;
  } catch (error) {
    console.error('[Event Service] Error logging message:', error);
    throw error;
  }
}

/**
 * Get events for a deal
 * 
 * @param {string} dealId - Deal ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Events
 */
export async function getDealEvents(dealId, options = {}) {
  try {
    const { limit = 100, offset = 0 } = options;
    
    const { data, error } = await supabase
      .from('deal_events')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('[Event Service] Error fetching events:', error);
    throw error;
  }
}
