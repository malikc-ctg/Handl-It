// ============================================
// Deal Linking Service
// Server-side logic for auto-creating/linking deals from quotes
// ============================================

import { supabase } from '../supabase.js';

/**
 * Configuration constants
 */
export const DEAL_LINKING_CONFIG = {
  followUpDefaultHours: 24,
  dedupeWindowDays: 30,
  minBindingOverwrite: true, // binding overwrites non-binding
};

/**
 * Handle quote revision sent event
 * Finds or creates a deal and links the quote to it
 * 
 * @param {string} quoteId - Quote ID
 * @param {number} revisionNumber - Revision number
 * @param {number} followUpHours - Hours until next action (default: 24)
 * @returns {Promise<{dealId: string, created: boolean}>}
 */
export async function onQuoteRevisionSent(quoteId, revisionNumber, followUpHours = DEAL_LINKING_CONFIG.followUpDefaultHours) {
  try {
    const { data, error } = await supabase.rpc('on_quote_revision_sent', {
      p_quote_id: quoteId,
      p_revision_number: revisionNumber,
      p_follow_up_hours: followUpHours
    });

    if (error) {
      console.error('[Deal Linking] Error in on_quote_revision_sent:', error);
      throw error;
    }

    // Check if deal was created (by checking if it exists and source is quote_auto)
    const { data: deal } = await supabase
      .from('deals')
      .select('id, source, created_at')
      .eq('id', data)
      .single();

    const created = deal?.source === 'quote_auto' && 
                    deal?.created_at && 
                    new Date(deal.created_at) > new Date(Date.now() - 5000); // Created within last 5 seconds

    return {
      dealId: data,
      created
    };
  } catch (error) {
    console.error('[Deal Linking] Error handling quote revision sent:', error);
    throw error;
  }
}

/**
 * Handle quote accepted event
 * Updates deal to Won stage
 * 
 * @param {string} quoteId - Quote ID
 * @param {number} revisionNumber - Revision number
 * @param {{ name?: string; email?: string }} [signerInfo] - Signer information
 * @returns {Promise<{dealId: string}>}
 */
export async function onQuoteAccepted(quoteId, revisionNumber, signerInfo = {}) {
  try {
    const { data, error } = await supabase.rpc('on_quote_accepted', {
      p_quote_id: quoteId,
      p_revision_number: revisionNumber,
      p_signer_name: (signerInfo && signerInfo.name) || null,
      p_signer_email: (signerInfo && signerInfo.email) || null
    });

    if (error) {
      console.error('[Deal Linking] Error in on_quote_accepted:', error);
      throw error;
    }

    return {
      dealId: data
    };
  } catch (error) {
    console.error('[Deal Linking] Error handling quote accepted:', error);
    throw error;
  }
}

/**
 * Handle quote declined event
 * Updates deal to Lost stage
 * 
 * @param {string} quoteId - Quote ID
 * @param {number} revisionNumber - Revision number
 * @param {string} reason - Decline reason
 * @returns {Promise<{dealId: string}>}
 */
export async function onQuoteDeclined(quoteId, revisionNumber, reason = null) {
  try {
    const { data, error } = await supabase.rpc('on_quote_declined', {
      p_quote_id: quoteId,
      p_revision_number: revisionNumber,
      p_reason: reason
    });

    if (error) {
      console.error('[Deal Linking] Error in on_quote_declined:', error);
      throw error;
    }

    return {
      dealId: data
    };
  } catch (error) {
    console.error('[Deal Linking] Error handling quote declined:', error);
    throw error;
  }
}

/**
 * Handle quote expired event
 * Marks deal as at risk
 * 
 * @param {string} quoteId - Quote ID
 * @param {number} revisionNumber - Revision number
 * @returns {Promise<{dealId: string}>}
 */
export async function onQuoteExpired(quoteId, revisionNumber) {
  try {
    const { data, error } = await supabase.rpc('on_quote_expired', {
      p_quote_id: quoteId,
      p_revision_number: revisionNumber
    });

    if (error) {
      console.error('[Deal Linking] Error in on_quote_expired:', error);
      throw error;
    }

    return {
      dealId: data
    };
  } catch (error) {
    console.error('[Deal Linking] Error handling quote expired:', error);
    throw error;
  }
}

/**
 * Handle quote viewed event
 * Updates deal last activity
 * 
 * @param {string} quoteId - Quote ID
 * @param {number} revisionNumber - Revision number
 * @returns {Promise<{dealId: string}>}
 */
export async function onQuoteViewed(quoteId, revisionNumber) {
  try {
    const { data, error } = await supabase.rpc('on_quote_viewed', {
      p_quote_id: quoteId,
      p_revision_number: revisionNumber
    });

    if (error) {
      console.error('[Deal Linking] Error in on_quote_viewed:', error);
      throw error;
    }

    return {
      dealId: data
    };
  } catch (error) {
    console.error('[Deal Linking] Error handling quote viewed:', error);
    throw error;
  }
}

/**
 * Find matching active deal (for testing/debugging)
 * 
 * @param {Object} params - Search parameters
 * @param {number} params.accountId - Account ID
 * @param {string} params.primaryContactId - Primary contact ID (optional)
 * @param {string} params.ownerUserId - Owner user ID (optional)
 * @param {number} params.dedupeWindowDays - Dedupe window in days (default: 30)
 * @returns {Promise<string|null>} Deal ID or null
 */
export async function findMatchingActiveDeal(params) {
  try {
    const { data, error } = await supabase.rpc('find_matching_active_deal', {
      p_account_id: params.accountId,
      p_primary_contact_id: params.primaryContactId || null,
      p_owner_user_id: params.ownerUserId || null,
      p_dedupe_window_days: params.dedupeWindowDays || DEAL_LINKING_CONFIG.dedupeWindowDays
    });

    if (error) {
      console.error('[Deal Linking] Error in find_matching_active_deal:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[Deal Linking] Error finding matching deal:', error);
    throw error;
  }
}
