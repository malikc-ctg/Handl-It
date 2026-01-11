// ============================================
// Analytics Service - Sales Funnel Analytics
// ============================================

import { supabase } from '../supabase.js';

/**
 * Get sales funnel analytics
 * Calls -> Connections -> Quotes -> Wins
 * 
 * @param {Object} options - Query options
 * @param {string} options.companyId - Company ID
 * @param {Date} options.startDate - Start date
 * @param {Date} options.endDate - End date
 * @returns {Promise<Object>} Analytics data
 */
export async function getSalesFunnelAnalytics(options = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const companyId = options.companyId || user.id;
    const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
    const endDate = options.endDate || new Date();
    
    // Get calls count for deals in this company
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select('id')
      .eq('company_id', companyId);
    
    if (dealsError) throw dealsError;
    
    const dealIds = (deals || []).map(d => d.id);
    
    if (dealIds.length === 0) {
      return {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        metrics: {
          calls: 0,
          connections: 0,
          quotes_sent: 0,
          wins: 0
        },
        conversion_rates: {
          calls_to_connections: 0,
          connections_to_quotes: 0,
          quotes_to_wins: 0,
          overall: 0
        }
      };
    }
    
    // Get calls count
    const { count: callsCount, error: callsError } = await supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .in('deal_id', dealIds)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    if (callsError) throw callsError;
    
    // Get connections (deals with activity)
    const { count: connectionsCount, error: connectionsError } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gt('touch_count', 0)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    if (connectionsError) throw connectionsError;
    
    // Get quotes sent
    const { count: quotesCount, error: quotesError } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .in('deal_id', dealIds)
      .gte('sent_at', startDate.toISOString())
      .lte('sent_at', endDate.toISOString());
    
    if (quotesError) throw quotesError;
    
    // Get wins (closed won deals)
    const { count: winsCount, error: winsError } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('stage', 'closed_won')
      .gte('updated_at', startDate.toISOString())
      .lte('updated_at', endDate.toISOString());
    
    if (winsError) throw winsError;
    
    // Calculate conversion rates
    const callsToConnectionsRate = callsCount > 0 ? (connectionsCount / callsCount * 100) : 0;
    const connectionsToQuotesRate = connectionsCount > 0 ? (quotesCount / connectionsCount * 100) : 0;
    const quotesToWinsRate = quotesCount > 0 ? (winsCount / quotesCount * 100) : 0;
    const overallConversionRate = callsCount > 0 ? (winsCount / callsCount * 100) : 0;
    
    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      metrics: {
        calls: callsCount || 0,
        connections: connectionsCount || 0,
        quotes_sent: quotesCount || 0,
        wins: winsCount || 0
      },
      conversion_rates: {
        calls_to_connections: Math.round(callsToConnectionsRate * 100) / 100,
        connections_to_quotes: Math.round(connectionsToQuotesRate * 100) / 100,
        quotes_to_wins: Math.round(quotesToWinsRate * 100) / 100,
        overall: Math.round(overallConversionRate * 100) / 100
      }
    };
  } catch (error) {
    console.error('[Analytics Service] Error fetching funnel analytics:', error);
    throw error;
  }
}

/**
 * Get detailed funnel breakdown
 * 
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Detailed funnel data
 */
export async function getFunnelBreakdown(options = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const companyId = options.companyId || user.id;
    const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = options.endDate || new Date();
    
    // Get all deals in period
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select('*')
      .eq('company_id', companyId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    if (dealsError) throw dealsError;
    
    // Aggregate by stage
    const stageBreakdown = {
      prospecting: 0,
      qualification: 0,
      proposal: 0,
      negotiation: 0,
      closed_won: 0,
      closed_lost: 0
    };
    
    const stageValue = {
      prospecting: 0,
      qualification: 0,
      proposal: 0,
      negotiation: 0,
      closed_won: 0,
      closed_lost: 0
    };
    
    (deals || []).forEach(deal => {
      stageBreakdown[deal.stage] = (stageBreakdown[deal.stage] || 0) + 1;
      stageValue[deal.stage] = (stageValue[deal.stage] || 0) + (deal.deal_value || 0);
    });
    
    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      stage_breakdown: {
        counts: stageBreakdown,
        values: stageValue
      },
      total_deals: deals?.length || 0,
      total_value: Object.values(stageValue).reduce((sum, val) => sum + val, 0)
    };
  } catch (error) {
    console.error('[Analytics Service] Error fetching funnel breakdown:', error);
    throw error;
  }
}

/**
 * Get activity timeline analytics
 * 
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Activity analytics
 */
export async function getActivityAnalytics(options = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const companyId = options.companyId || user.id;
    const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = options.endDate || new Date();
    
    // Get deal IDs for this company
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select('id')
      .eq('company_id', companyId);
    
    if (dealsError) throw dealsError;
    
    const dealIds = (deals || []).map(d => d.id);
    
    if (dealIds.length === 0) {
      return {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        activity: {
          calls: 0,
          messages: 0,
          visits: 0,
          events: 0,
          total: 0
        }
      };
    }
    
    // Get activity counts by type
    const [calls, messages, visits, events] = await Promise.all([
      supabase
        .from('calls')
        .select('*', { count: 'exact', head: true })
        .in('deal_id', dealIds)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString()),
      
      supabase
        .from('deal_messages')
        .select('*', { count: 'exact', head: true })
        .in('deal_id', dealIds)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString()),
      
      supabase
        .from('door_visits')
        .select('*', { count: 'exact', head: true })
        .in('deal_id', dealIds)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString()),
      
      supabase
        .from('deal_events')
        .select('*', { count: 'exact', head: true })
        .in('deal_id', dealIds)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
    ]);
    
    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      activity: {
        calls: calls.count || 0,
        messages: messages.count || 0,
        visits: visits.count || 0,
        events: events.count || 0,
        total: (calls.count || 0) + (messages.count || 0) + (visits.count || 0) + (events.count || 0)
      }
    };
  } catch (error) {
    console.error('[Analytics Service] Error fetching activity analytics:', error);
    throw error;
  }
}
