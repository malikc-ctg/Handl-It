// ============================================
// Quote Service - Templates, Versioning, Line Items
// ============================================

import { supabase } from '../supabase.js';

/**
 * Get quote templates by vertical
 * 
 * @param {string} vertical - Vertical (e.g., 'commercial_cleaning')
 * @returns {Promise<Array>} Quote templates
 */
export async function getQuoteTemplates(vertical = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    let query = supabase
      .from('quote_templates')
      .select('*')
      .eq('company_id', user.id);
    
    if (vertical) {
      query = query.eq('vertical', vertical);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('[Quote Service] Error fetching templates:', error);
    throw error;
  }
}

/**
 * Create a new quote from template or scratch
 * 
 * @param {Object} quoteData - Quote data
 * @param {string} quoteData.deal_id - Deal ID
 * @param {string} [quoteData.template_id] - Template ID (optional)
 * @param {string} [quoteData.variant] - Variant: 'good', 'better', 'best'
 * @param {Array} [quoteData.line_items] - Line items array
 * @returns {Promise<Object>} Created quote
 */
export async function createQuote(quoteData) {
  try {
    const { deal_id, template_id, variant, line_items = [] } = quoteData;
    
    // Calculate total from line items
    const total_amount = line_items.reduce((sum, item) => {
      return sum + ((item.quantity || 1) * (item.unit_price || 0));
    }, 0);
    
    // Create quote
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        deal_id,
        template_id: template_id || null,
        variant: variant || null,
        version: 1,
        status: 'drafted',
        total_amount,
        currency: quoteData.currency || 'USD',
        valid_until: quoteData.valid_until || null,
        notes: quoteData.notes || null
      })
      .select()
      .single();
    
    if (quoteError) throw quoteError;
    
    // Create line items
    if (line_items.length > 0) {
      const items = line_items.map((item, index) => ({
        quote_id: quote.id,
        description: item.description,
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        sequence_order: item.sequence_order || index
      }));
      
      const { error: itemsError } = await supabase
        .from('quote_line_items')
        .insert(items);
      
      if (itemsError) throw itemsError;
    }
    
    // Reload quote with line items
    return await getQuoteDetails(quote.id);
  } catch (error) {
    console.error('[Quote Service] Error creating quote:', error);
    throw error;
  }
}

/**
 * Create new quote version (preserves history)
 * 
 * @param {string} dealId - Deal ID
 * @param {string} [baseQuoteId] - Base quote ID to copy from (optional)
 * @returns {Promise<Object>} New quote version
 */
export async function createQuoteVersion(dealId, baseQuoteId = null) {
  try {
    // Call database function
    const { data, error } = await supabase.rpc('create_quote_version', {
      p_deal_id: dealId,
      p_base_quote_id: baseQuoteId
    });
    
    if (error) throw error;
    
    // Get the new quote details
    return await getQuoteDetails(data);
  } catch (error) {
    console.error('[Quote Service] Error creating quote version:', error);
    throw error;
  }
}

/**
 * Get quote details with line items
 * 
 * @param {string} quoteId - Quote ID
 * @returns {Promise<Object>} Quote with line items
 */
export async function getQuoteDetails(quoteId) {
  try {
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select(`
        *,
        deal:deals(id, title, stage, contact_id),
        template:quote_templates(*),
        line_items:quote_line_items(*)
      `)
      .eq('id', quoteId)
      .single();
    
    if (quoteError) throw quoteError;
    
    // Sort line items by sequence_order
    if (quote.line_items) {
      quote.line_items.sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0));
    }
    
    return quote;
  } catch (error) {
    console.error('[Quote Service] Error fetching quote:', error);
    throw error;
  }
}

/**
 * Update quote (creates new version if quote was already sent)
 * 
 * @param {string} quoteId - Quote ID
 * @param {Object} updates - Updates to apply
 * @param {boolean} createNewVersion - Force new version creation
 * @returns {Promise<Object>} Updated or new quote
 */
export async function updateQuote(quoteId, updates, createNewVersion = false) {
  try {
    // Get current quote
    const currentQuote = await getQuoteDetails(quoteId);
    
    // If quote was sent and we're updating, create new version
    if (createNewVersion || (currentQuote.status !== 'drafted' && currentQuote.status !== 'rejected')) {
      const newVersion = await createQuoteVersion(currentQuote.deal_id, quoteId);
      
      // Apply updates to new version
      if (Object.keys(updates).length > 0) {
        return await updateQuote(newVersion.id, updates, false);
      }
      
      return newVersion;
    }
    
    // Update line items if provided
    if (updates.line_items) {
      // Delete existing line items
      await supabase
        .from('quote_line_items')
        .delete()
        .eq('quote_id', quoteId);
      
      // Insert new line items
      const items = updates.line_items.map((item, index) => ({
        quote_id: quoteId,
        description: item.description,
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        sequence_order: item.sequence_order || index
      }));
      
      await supabase
        .from('quote_line_items')
        .insert(items);
      
      // Recalculate total
      const total_amount = items.reduce((sum, item) => {
        return sum + (item.quantity * item.unit_price);
      }, 0);
      
      updates.total_amount = total_amount;
      delete updates.line_items; // Remove from updates object
    }
    
    // Update quote
    const { data, error } = await supabase
      .from('quotes')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', quoteId)
      .select()
      .single();
    
    if (error) throw error;
    
    return await getQuoteDetails(quoteId);
  } catch (error) {
    console.error('[Quote Service] Error updating quote:', error);
    throw error;
  }
}

/**
 * Send quote (updates status and triggers email/message workflow)
 * 
 * @param {string} quoteId - Quote ID
 * @returns {Promise<Object>} Updated quote
 */
export async function sendQuote(quoteId) {
  try {
    // Update quote status
    const { data, error } = await supabase
      .from('quotes')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', quoteId)
      .select()
      .single();
    
    if (error) throw error;
    
    // Create event
    await supabase
      .from('deal_events')
      .insert({
        deal_id: data.deal_id,
        event_type: 'quote_sent',
        new_value: { quote_id: quoteId, quote_version: data.version }
      });
    
    // TODO: Trigger email/message workflow (integrate with messaging system)
    // This would send an email or SMS with the quote PDF/link
    
    return data;
  } catch (error) {
    console.error('[Quote Service] Error sending quote:', error);
    throw error;
  }
}

/**
 * Mark quote as viewed
 * 
 * @param {string} quoteId - Quote ID
 * @returns {Promise<Object>} Updated quote
 */
export async function markQuoteViewed(quoteId) {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .update({
        status: 'viewed',
        viewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', quoteId)
      .select()
      .single();
    
    if (error) throw error;
    
    // Create event if not already viewed
    if (!data.viewed_at) {
      await supabase
        .from('deal_events')
        .insert({
          deal_id: data.deal_id,
          event_type: 'quote_viewed',
          new_value: { quote_id: quoteId }
        });
    }
    
    return data;
  } catch (error) {
    console.error('[Quote Service] Error marking quote viewed:', error);
    throw error;
  }
}

/**
 * Accept or reject quote
 * 
 * @param {string} quoteId - Quote ID
 * @param {string} action - 'accepted' or 'rejected'
 * @returns {Promise<Object>} Updated quote
 */
export async function respondToQuote(quoteId, action) {
  try {
    const isAccepted = action === 'accepted';
    const updateData = {
      status: isAccepted ? 'accepted' : 'rejected',
      updated_at: new Date().toISOString()
    };
    
    if (isAccepted) {
      updateData.accepted_at = new Date().toISOString();
    } else {
      updateData.rejected_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from('quotes')
      .update(updateData)
      .eq('id', quoteId)
      .select()
      .single();
    
    if (error) throw error;
    
    // Create event
    await supabase
      .from('deal_events')
      .insert({
        deal_id: data.deal_id,
        event_type: isAccepted ? 'quote_accepted' : 'quote_rejected',
        new_value: { quote_id: quoteId }
      });
    
    // If accepted, potentially move deal to next stage
    if (isAccepted) {
      await supabase
        .from('deals')
        .update({
          stage: 'negotiation',
          last_touch_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', data.deal_id);
    }
    
    return data;
  } catch (error) {
    console.error('[Quote Service] Error responding to quote:', error);
    throw error;
  }
}

/**
 * Get all quotes for a deal
 * 
 * @param {string} dealId - Deal ID
 * @returns {Promise<Array>} All quotes for the deal
 */
export async function getDealQuotes(dealId) {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .select(`
        *,
        line_items:quote_line_items(*)
      `)
      .eq('deal_id', dealId)
      .order('version', { ascending: false });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('[Quote Service] Error fetching deal quotes:', error);
    throw error;
  }
}
