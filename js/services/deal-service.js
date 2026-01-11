// ============================================
// Deal Service - Priority Queue & Management
// ============================================

import { supabase } from '../supabase.js';

/**
 * Calculate priority score for a deal
 * Formula: (deal_value_weighted) * (close_likelihood_proxy) * (urgency_decay)
 * 
 * @param {Object} deal - Deal object
 * @returns {number} Priority score
 */
export function calculatePriorityScore(deal) {
  // Deal value weighted (normalize to 0-1, using $100k as max)
  const dealValueWeighted = Math.min((deal.deal_value || 0) / 100000, 1);
  
  // Stage multipliers
  const stageMultipliers = {
    'prospecting': 0.2,
    'qualification': 0.4,
    'proposal': 0.6,
    'negotiation': 0.8,
    'closed_won': 1.0,
    'closed_lost': 0.0
  };
  
  const stageMultiplier = stageMultipliers[deal.stage] || 0.3;
  
  // Touch bonus (more touches = more engagement)
  const touchBonus = Math.min((deal.touch_count || 0) / 10, 1) * 0.2;
  
  // Close likelihood proxy
  const closeLikelihoodProxy = (stageMultiplier * 0.6) + 
                               ((deal.probability || 0) / 100 * 0.2) + 
                               touchBonus;
  
  // Urgency decay (exponential decay based on last touch recency)
  let daysSinceTouch = 30; // Default to stale
  if (deal.last_touch_at) {
    const now = new Date();
    const lastTouch = new Date(deal.last_touch_at);
    daysSinceTouch = (now - lastTouch) / (1000 * 60 * 60 * 24);
  }
  
  // Exponential decay: urgency drops over time
  const urgencyDecay = Math.exp(-daysSinceTouch / 10);
  
  // Final score
  return dealValueWeighted * closeLikelihoodProxy * urgencyDecay * 100;
}

/**
 * Get prioritized deal queue with pagination
 * 
 * @param {Object} options - Query options
 * @param {number} options.limit - Number of deals to return
 * @param {number} options.offset - Pagination offset
 * @param {string} options.stage - Filter by stage
 * @param {string} options.assignedTo - Filter by assigned user
 * @param {string} options.companyId - Company ID (from user context)
 * @returns {Promise<{data: Array, total: number}>}
 */
export async function getDealQueue(options = {}) {
  const {
    limit = 20,
    offset = 0,
    stage = null,
    assignedTo = null,
    companyId = null
  } = options;
  
  try {
    // Get current user for company_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    // Build query
    let query = supabase
      .from('deals')
      .select(`
        *,
        contact:contacts(*),
        site:sites(id, name, address)
      `, { count: 'exact' })
      .eq('company_id', companyId || user.id)
      .order('priority_score', { ascending: false, nullsLast: true })
      .range(offset, offset + limit - 1);
    
    // Apply filters
    if (stage) {
      query = query.eq('stage', stage);
    }
    
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    // Recalculate priority scores (in case they're stale)
    const dealsWithScores = (data || []).map(deal => ({
      ...deal,
      calculated_priority_score: calculatePriorityScore(deal)
    })).sort((a, b) => (b.calculated_priority_score || 0) - (a.calculated_priority_score || 0));
    
    return {
      data: dealsWithScores,
      total: count || 0,
      limit,
      offset
    };
  } catch (error) {
    console.error('[Deal Service] Error fetching deal queue:', error);
    throw error;
  }
}

/**
 * Get single deal with full details and timeline
 * 
 * @param {string} dealId - Deal ID
 * @returns {Promise<Object>} Deal with contact, property, timeline, and next actions
 */
export async function getDealDetails(dealId) {
  try {
    // Get deal with relations
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select(`
        *,
        contact:contacts(*),
        site:sites(id, name, address, status, deal_value)
      `)
      .eq('id', dealId)
      .single();
    
    if (dealError) throw dealError;
    if (!deal) throw new Error('Deal not found');
    
    // Get timeline (events, calls, messages, quote actions)
    const timeline = await getDealTimeline(dealId);
    
    // Get next action suggestions
    const nextActions = getNextActionSuggestions(deal, timeline);
    
    return {
      ...deal,
      timeline,
      next_actions: nextActions
    };
  } catch (error) {
    console.error('[Deal Service] Error fetching deal details:', error);
    throw error;
  }
}

/**
 * Get deal timeline (all events, calls, messages, quotes)
 * 
 * @param {string} dealId - Deal ID
 * @returns {Promise<Array>} Timeline entries sorted by time
 */
export async function getDealTimeline(dealId) {
  try {
    // Get all timeline entries in parallel
    const [events, calls, messages, quotes, visits] = await Promise.all([
      // Events
      supabase
        .from('deal_events')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false }),
      
      // Calls
      supabase
        .from('calls')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false }),
      
      // Messages
      supabase
        .from('deal_messages')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false }),
      
      // Quotes (key actions only)
      supabase
        .from('quotes')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false }),
      
      // Door visits
      supabase
        .from('door_visits')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
    ]);
    
    // Combine and normalize timeline entries
    const timeline = [];
    
    // Events
    (events.data || []).forEach(event => {
      timeline.push({
        id: event.id,
        type: 'event',
        event_type: event.event_type,
        timestamp: event.created_at,
        user_id: event.user_id,
        metadata: event.metadata,
        description: formatEventDescription(event)
      });
    });
    
    // Calls
    (calls.data || []).forEach(call => {
      timeline.push({
        id: call.id,
        type: 'call',
        call_type: call.call_type,
        duration_seconds: call.duration_seconds,
        outcome: call.outcome,
        notes: call.notes,
        timestamp: call.created_at,
        user_id: call.user_id
      });
    });
    
    // Messages
    (messages.data || []).forEach(message => {
      timeline.push({
        id: message.id,
        type: 'message',
        direction: message.direction,
        channel: message.channel,
        subject: message.subject,
        body: message.body,
        timestamp: message.created_at,
        user_id: message.user_id
      });
    });
    
    // Quote actions
    (quotes.data || []).forEach(quote => {
      if (quote.sent_at) {
        timeline.push({
          id: `quote-sent-${quote.id}`,
          type: 'quote',
          action: 'sent',
          quote_id: quote.id,
          version: quote.version,
          variant: quote.variant,
          amount: quote.total_amount,
          timestamp: quote.sent_at
        });
      }
      if (quote.viewed_at) {
        timeline.push({
          id: `quote-viewed-${quote.id}`,
          type: 'quote',
          action: 'viewed',
          quote_id: quote.id,
          version: quote.version,
          timestamp: quote.viewed_at
        });
      }
      if (quote.accepted_at) {
        timeline.push({
          id: `quote-accepted-${quote.id}`,
          type: 'quote',
          action: 'accepted',
          quote_id: quote.id,
          version: quote.version,
          timestamp: quote.accepted_at
        });
      }
      if (quote.rejected_at) {
        timeline.push({
          id: `quote-rejected-${quote.id}`,
          type: 'quote',
          action: 'rejected',
          quote_id: quote.id,
          version: quote.version,
          timestamp: quote.rejected_at
        });
      }
    });
    
    // Door visits
    (visits.data || []).forEach(visit => {
      timeline.push({
        id: visit.id,
        type: 'visit',
        visit_date: visit.visit_date,
        outcome: visit.outcome,
        notes: visit.notes,
        timestamp: visit.created_at,
        user_id: visit.user_id
      });
    });
    
    // Sort by timestamp (newest first)
    timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return timeline;
  } catch (error) {
    console.error('[Deal Service] Error fetching timeline:', error);
    throw error;
  }
}

/**
 * Format event description for display
 */
function formatEventDescription(event) {
  const descriptions = {
    'deal_created': 'Deal created',
    'deal_stage_changed': `Stage changed to ${event.new_value?.stage || 'unknown'}`,
    'deal_value_changed': `Value changed to $${event.new_value?.deal_value || 0}`,
    'quote_sent': 'Quote sent',
    'quote_viewed': 'Quote viewed',
    'quote_accepted': 'Quote accepted',
    'quote_rejected': 'Quote rejected',
    'call_logged': 'Call logged',
    'message_sent': 'Message sent',
    'message_received': 'Message received',
    'door_visit_logged': 'Door visit logged',
    'note_added': 'Note added',
    'contact_updated': 'Contact updated',
    'sequence_started': 'Follow-up sequence started',
    'sequence_stopped': 'Follow-up sequence stopped'
  };
  
  return descriptions[event.event_type] || event.event_type;
}

/**
 * Get next action suggestions based on deal state
 */
function getNextActionSuggestions(deal, timeline) {
  const actions = [];
  
  // Check last touch
  const lastTouch = timeline[0];
  const daysSinceTouch = lastTouch 
    ? (new Date() - new Date(lastTouch.timestamp)) / (1000 * 60 * 60 * 24)
    : 999;
  
  // Stage-based actions
  switch (deal.stage) {
    case 'prospecting':
      actions.push({
        type: 'call',
        label: 'Make initial call',
        priority: 'high',
        allowed: true
      });
      actions.push({
        type: 'visit',
        label: 'Schedule door visit',
        priority: 'medium',
        allowed: true
      });
      break;
    
    case 'qualification':
      actions.push({
        type: 'quote',
        label: 'Create quote',
        priority: 'high',
        allowed: true
      });
      if (daysSinceTouch > 3) {
        actions.push({
          type: 'message',
          label: 'Follow up',
          priority: 'high',
          allowed: true
        });
      }
      break;
    
    case 'proposal':
      // Check if quote exists and is sent
      {
        const sentQuote = timeline.find(t => t.type === 'quote' && t.action === 'sent');
        if (!sentQuote) {
          actions.push({
            type: 'quote',
            label: 'Send quote',
            priority: 'high',
            allowed: true
          });
        } else if (daysSinceTouch > 2) {
          actions.push({
            type: 'message',
            label: 'Follow up on quote',
            priority: 'high',
            allowed: true
          });
        }
      }
      break;
    
    case 'negotiation':
      actions.push({
        type: 'call',
        label: 'Schedule negotiation call',
        priority: 'high',
        allowed: true
      });
      break;
  }
  
  // Generic actions
  if (daysSinceTouch > 7) {
    actions.push({
      type: 'message',
      label: 'Re-engage contact',
      priority: 'medium',
      allowed: true
    });
  }
  
  return actions;
}

/**
 * Update deal stage
 * 
 * @param {string} dealId - Deal ID
 * @param {string} newStage - New stage
 * @param {string} userId - User ID performing the action
 * @returns {Promise<Object>} Updated deal
 */
export async function updateDealStage(dealId, newStage, _userId) {
  try {
    // Get current deal to increment touch_count
    const { data: currentDeal } = await supabase
      .from('deals')
      .select('touch_count')
      .eq('id', dealId)
      .single();
    
    const { data, error } = await supabase
      .from('deals')
      .update({
        stage: newStage,
        last_touch_at: new Date().toISOString(),
        touch_count: (currentDeal?.touch_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', dealId)
      .select()
      .single();
    
    if (error) throw error;
    
    // Event is created automatically by trigger
    
    return data;
  } catch (error) {
    console.error('[Deal Service] Error updating deal stage:', error);
    throw error;
  }
}

/**
 * Create a new deal
 * 
 * @param {Object} dealData - Deal data
 * @returns {Promise<Object>} Created deal
 */
export async function createDeal(dealData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('deals')
      .insert({
        ...dealData,
        company_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('[Deal Service] Error creating deal:', error);
    throw error;
  }
}

/**
 * Mark deal as won/lost
 * 
 * @param {string} dealId - Deal ID
 * @param {string} outcome - 'won' or 'lost'
 * @returns {Promise<Object>} Updated deal
 */
export async function closeDeal(dealId, outcome) {
  try {
    const stage = outcome === 'won' ? 'closed_won' : 'closed_lost';
    
    const { data, error } = await supabase
      .from('deals')
      .update({
        stage,
        updated_at: new Date().toISOString()
      })
      .eq('id', dealId)
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('[Deal Service] Error closing deal:', error);
    throw error;
  }
}
