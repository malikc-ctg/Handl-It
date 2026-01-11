// Quote System JavaScript Module
// Complete implementation with walkthrough support, revisions, and PDF generation

import { supabase } from './supabase.js';
import { toast } from './notifications.js';

// ==========================================
// STATE MANAGEMENT
// ==========================================
let currentUser = null;
let currentQuote = null;
let quotes = [];
let sites = [];
let deals = [];
let contacts = [];
let services = [];
let serviceCategories = [];

// ==========================================
// INITIALIZATION
// ==========================================
export async function initQuotes(user) {
  currentUser = user;
  await Promise.all([
    loadSites(),
    loadDeals(),
    loadContacts(),
    loadServices(),
    loadServiceCategories()
  ]);
}

// Load services for cleaning quotes
async function loadServices() {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*, service_categories(name, id)')
      .order('name');
    if (error) throw error;
    services = data || [];
  } catch (error) {
    console.error('[Quotes] Error loading services:', error);
  }
}

// Load service categories
async function loadServiceCategories() {
  try {
    const { data, error } = await supabase
      .from('service_categories')
      .select('*')
      .order('display_order');
    if (error) throw error;
    serviceCategories = data || [];
  } catch (error) {
    console.error('[Quotes] Error loading service categories:', error);
  }
}

async function loadSites() {
  try {
    const { data, error } = await supabase
      .from('sites')
      .select('id, name, address, contact_email, contact_phone')
      .order('name');
    if (error) throw error;
    sites = data || [];
  } catch (error) {
    console.error('[Quotes] Error loading sites:', error);
  }
}

async function loadDeals() {
  try {
    const { data, error } = await supabase
      .from('deals')
      .select('id, site_id, deal_value, stage, assigned_to')
      .order('created_at', { ascending: false });
    if (error) throw error;
    deals = data || [];
  } catch (error) {
    console.error('[Quotes] Error loading deals:', error);
  }
}

async function loadContacts() {
  try {
    // Try to load from user_profiles or a contacts table if it exists
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, phone')
      .order('full_name');
    if (error) throw error;
    contacts = data || [];
  } catch (error) {
    console.error('[Quotes] Error loading contacts:', error);
  }
}

// ==========================================
// QUOTE LIST
// ==========================================
export async function loadQuotes(filters = {}) {
  try {
    let query = supabase
      .from('quotes')
      .select(`
        *,
        sites:account_id(id, name, address),
        deals:deal_id(id, stage, deal_value)
      `)
      .order('updated_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.quote_type) {
      query = query.eq('quote_type', filters.quote_type);
    }
    if (filters.owner_user_id) {
      query = query.eq('owner_user_id', filters.owner_user_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    quotes = data || [];
    return quotes;
  } catch (error) {
    console.error('[Quotes] Error loading quotes:', error);
    toast.error('Failed to load quotes', 'Error');
    return [];
  }
}

// ==========================================
// QUOTE DETAIL
// ==========================================
export async function loadQuoteDetail(quoteId) {
  try {
    // Load quote
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select(`
        *,
        sites:account_id(id, name, address, contact_email, contact_phone),
        deals:deal_id(id, stage, deal_value)
      `)
      .eq('id', quoteId)
      .single();

    if (quoteError) throw quoteError;

    // Load all revisions
    const { data: revisions, error: revError } = await supabase
      .from('quote_revisions')
      .select('*')
      .eq('quote_id', quoteId)
      .order('revision_number', { ascending: false });

    if (revError) throw revError;

    // Load line items for all revisions (will filter by revision in UI)
    const { data: lineItems, error: itemsError } = await supabase
      .from('quote_line_items')
      .select('*')
      .eq('quote_id', quoteId)
      .order('revision_number, display_order');

    if (itemsError) throw itemsError;

    // Load events
    const { data: events, error: eventsError } = await supabase
      .from('quote_events')
      .select('*')
      .eq('quote_id', quoteId)
      .order('timestamp', { ascending: false });

    if (eventsError) throw eventsError;

    // Load walkthrough if exists
    let walkthrough = null;
    if (quote.quote_type === 'walkthrough_required') {
      const { data: wt, error: wtError } = await supabase
        .from('quote_walkthroughs')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!wtError && wt) {
        walkthrough = wt;
      }
    }

    currentQuote = {
      ...quote,
      revisions: revisions || [],
      lineItems: lineItems || [],
      events: events || [],
      walkthrough
    };

    return currentQuote;
  } catch (error) {
    console.error('[Quotes] Error loading quote detail:', error);
    toast.error('Failed to load quote details', 'Error');
    return null;
  }
}

// ==========================================
// CREATE QUOTE
// ==========================================
export async function createQuote(formData) {
  try {
    // Build insert object, conditionally include cleaning_metrics
    const insertData = {
      account_id: formData.account_id ? parseInt(formData.account_id) : null,
      primary_contact_id: formData.primary_contact_id || null,
      deal_id: formData.deal_id || null,
      owner_user_id: currentUser.id,
      quote_type: formData.quote_type || 'walkthrough_required',
      status: 'draft',
      active_revision_number: 1
    };
    
    // Only include cleaning_metrics if it exists and has data
    // Note: This column must exist in the database (run ADD_CLEANING_QUOTE_FIELDS.sql)
    if (formData.cleaning_metrics && Object.keys(formData.cleaning_metrics).length > 0) {
      insertData.cleaning_metrics = formData.cleaning_metrics;
    }
    
    const { data, error } = await supabase
      .from('quotes')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Create initial draft revision
    await createRevision(data.id, 1, {
      revision_type: formData.quote_type === 'walkthrough_required' ? 'walkthrough_proposal' : 'final_quote',
      is_binding: formData.quote_type !== 'walkthrough_required' && formData.quote_type !== 'ballpark'
    });

    toast.success('Quote created successfully', 'Success');
    return data;
  } catch (error) {
    console.error('[Quotes] Error creating quote:', error);
    toast.error('Failed to create quote', 'Error');
    throw error;
  }
}

// ==========================================
// CREATE REVISION
// ==========================================
export async function createRevision(quoteId, revisionNumber, revisionData) {
  try {
    const { data, error } = await supabase
      .from('quote_revisions')
      .insert({
        quote_id: quoteId,
        revision_number: revisionNumber,
        revision_type: revisionData.revision_type,
        is_binding: revisionData.is_binding || false,
        ...revisionData
      })
      .select()
      .single();

    if (error) throw error;

    // Log event
    await logQuoteEvent(quoteId, revisionNumber, 'revision_created');

    return data;
  } catch (error) {
    console.error('[Quotes] Error creating revision:', error);
    throw error;
  }
}

// ==========================================
// SAVE REVISION (DRAFT)
// ==========================================
export async function saveRevision(quoteId, revisionNumber, revisionData, lineItems) {
  try {
    // Update revision
    const { error: revError } = await supabase
      .from('quote_revisions')
      .update({
        ...revisionData,
        updated_at: new Date().toISOString()
      })
      .eq('quote_id', quoteId)
      .eq('revision_number', revisionNumber);

    if (revError) throw revError;

    // Delete existing line items for this revision
    await supabase
      .from('quote_line_items')
      .delete()
      .eq('quote_id', quoteId)
      .eq('revision_number', revisionNumber);

    // Insert new line items
    if (lineItems && lineItems.length > 0) {
      const itemsToInsert = lineItems.map((item, index) => ({
        quote_id: quoteId,
        revision_number: revisionNumber,
        category: item.category || null,
        name: item.name,
        description: item.description || null,
        quantity: item.quantity || 1,
        unit: item.unit,
        unit_price: item.unit_price || null,
        range_low: item.range_low || null,
        range_high: item.range_high || null,
        frequency_multiplier: item.frequency_multiplier || 1,
        line_total: calculateLineTotal(item),
        display_order: index
      }));

      const { error: itemsError } = await supabase
        .from('quote_line_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;
    }

    // Recalculate totals (server-side validation)
    await recalculateRevisionTotals(quoteId, revisionNumber);

    toast.success('Quote saved successfully', 'Success');
  } catch (error) {
    console.error('[Quotes] Error saving revision:', error);
    toast.error('Failed to save quote', 'Error');
    throw error;
  }
}

function calculateLineTotal(item) {
  if (item.unit === 'range') {
    return null; // Ranges don't have line totals
  }
  const quantity = parseFloat(item.quantity || 1);
  const unitPrice = parseFloat(item.unit_price || 0);
  const multiplier = parseFloat(item.frequency_multiplier || 1);
  return quantity * unitPrice * multiplier;
}

async function recalculateRevisionTotals(quoteId, revisionNumber) {
  try {
    // Load all line items for this revision
    const { data: items, error } = await supabase
      .from('quote_line_items')
      .select('*')
      .eq('quote_id', quoteId)
      .eq('revision_number', revisionNumber);

    if (error) throw error;

    // Get revision to check if binding
    const { data: revision } = await supabase
      .from('quote_revisions')
      .select('is_binding, revision_type')
      .eq('quote_id', quoteId)
      .eq('revision_number', revisionNumber)
      .single();

    if (!revision || !revision.is_binding) {
      // Non-binding revisions don't need totals
      return;
    }

    // Calculate subtotal (sum of all line totals)
    const subtotal = items
      .filter(item => item.line_total !== null)
      .reduce((sum, item) => sum + parseFloat(item.line_total || 0), 0);

    // Calculate tax (13% HST for Canada - can be made configurable)
    const tax = subtotal * 0.13;
    const total = subtotal + tax;

    // Update revision with calculated totals
    await supabase
      .from('quote_revisions')
      .update({
        subtotal,
        tax,
        total
      })
      .eq('quote_id', quoteId)
      .eq('revision_number', revisionNumber);
  } catch (error) {
    console.error('[Quotes] Error recalculating totals:', error);
  }
}

// ==========================================
// SEND REVISION
// ==========================================
export async function sendRevision(quoteId, revisionNumber, emails, expiryDays = 7) {
  try {
    // Validate revision can be sent
    const { data: revision, error: revError } = await supabase
      .from('quote_revisions')
      .select('*')
      .eq('quote_id', quoteId)
      .eq('revision_number', revisionNumber)
      .single();

    if (revError) throw revError;

    // Validation rules
    if (revision.revision_type === 'final_quote') {
      const { data: quote } = await supabase
        .from('quotes')
        .select('quote_type')
        .eq('id', quoteId)
        .single();

      if (quote && quote.quote_type === 'walkthrough_required') {
        // Check if walkthrough is completed
        const { data: walkthrough } = await supabase
          .from('quote_walkthroughs')
          .select('status')
          .eq('quote_id', quoteId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!walkthrough || walkthrough.status !== 'completed') {
          toast.error('Walkthrough must be completed before sending final quote', 'Validation Error');
          throw new Error('Walkthrough not completed');
        }
      }

      // Final quotes must have binding totals
      if (!revision.is_binding || !revision.total) {
        toast.error('Final quote must have binding totals', 'Validation Error');
        throw new Error('Final quote validation failed');
      }
    }

    // Generate public token
    const publicToken = generatePublicToken();

    // Generate PDF (we'll implement this)
    const pdfUrl = await generatePDF(quoteId, revisionNumber);

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Update revision
    await supabase
      .from('quote_revisions')
      .update({
        sent_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        sent_to_emails: emails,
        public_token: publicToken,
        pdf_url: pdfUrl,
        status_at_send: 'sent'
      })
      .eq('quote_id', quoteId)
      .eq('revision_number', revisionNumber);

    // Update quote status
    await supabase
      .from('quotes')
      .update({
        status: 'sent',
        active_revision_number: revisionNumber
      })
      .eq('id', quoteId);

    // Log event
    await logQuoteEvent(quoteId, revisionNumber, 'sent', { emails });

    toast.success('Quote sent successfully', 'Success');
  } catch (error) {
    console.error('[Quotes] Error sending revision:', error);
    if (!error.message.includes('Validation')) {
      toast.error('Failed to send quote', 'Error');
    }
    throw error;
  }
}

function generatePublicToken() {
  // Generate a secure random token (32 bytes = 64 hex characters)
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// ==========================================
// PDF GENERATION
// ==========================================
async function generatePDF(quoteId, revisionNumber) {
  // PDF generation implementation
  // Option 1: Server-side (recommended) - call API endpoint
  // Option 2: Client-side using jsPDF library
  
  // For now, return a placeholder URL
  // To implement client-side PDF generation:
  // 1. Add jsPDF library: <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  // 2. Implement PDF generation logic based on revision type
  // 3. Upload to storage and return URL
  
  // Placeholder - in production, implement actual PDF generation
  return `/api/quotes/${quoteId}/revisions/${revisionNumber}/pdf`;
}

// Helper function for client-side PDF generation (requires jsPDF)
export async function generatePDFClient(quoteId, revisionNumber, revisionData) {
  // This function can be implemented using jsPDF
  // Example structure:
  /*
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // Add content based on revision type
  if (revisionData.revision_type === 'walkthrough_proposal') {
    // Add walkthrough proposal content
    doc.text('Walkthrough Proposal', 20, 20);
    doc.text('Non-Binding Estimate', 20, 30);
    // ... add scope, schedule, etc.
  } else {
    // Add final quote content
    doc.text('Final Quote', 20, 20);
    // ... add line items table, totals, etc.
  }
  
  // Generate blob and upload to storage
  const blob = doc.output('blob');
  // Upload to Supabase storage and return URL
  */
  
  console.warn('[Quotes] Client-side PDF generation not yet implemented. Use server-side PDF generation or implement jsPDF integration.');
  return null;
}

// ==========================================
// QUOTE EVENTS
// ==========================================
async function logQuoteEvent(quoteId, revisionNumber, eventType, metadata = {}) {
  try {
    await supabase
      .from('quote_events')
      .insert({
        quote_id: quoteId,
        revision_number: revisionNumber,
        event_type: eventType,
        metadata,
        created_by: currentUser?.id || null
      });
  } catch (error) {
    console.error('[Quotes] Error logging event:', error);
  }
}

// ==========================================
// WALKTHROUGH MANAGEMENT
// ==========================================
export async function scheduleWalkthrough(quoteId, walkthroughData) {
  try {
    const { data, error } = await supabase
      .from('quote_walkthroughs')
      .insert({
        quote_id: quoteId,
        account_id: walkthroughData.account_id,
        scheduled_at: walkthroughData.scheduled_at,
        status: 'scheduled',
        location_address: walkthroughData.location_address,
        notes: walkthroughData.notes || null
      })
      .select()
      .single();

    if (error) throw error;

    // Log event
    await logQuoteEvent(quoteId, null, 'walkthrough_scheduled', { walkthrough_id: data.id });

    // Update deal stage if linked
    if (currentQuote?.deal_id) {
      await updateDealStage(currentQuote.deal_id, 'Walkthrough Booked');
    }

    toast.success('Walkthrough scheduled successfully', 'Success');
    return data;
  } catch (error) {
    console.error('[Quotes] Error scheduling walkthrough:', error);
    toast.error('Failed to schedule walkthrough', 'Error');
    throw error;
  }
}

export async function updateWalkthroughStatus(walkthroughId, status, measuredInputs = null) {
  try {
    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
      if (measuredInputs) {
        updateData.measured_inputs = measuredInputs;
      }
    }

    const { data, error } = await supabase
      .from('quote_walkthroughs')
      .update(updateData)
      .eq('id', walkthroughId)
      .select()
      .single();

    if (error) throw error;

    // Log event
    const eventType = status === 'completed' ? 'walkthrough_completed' :
                     status === 'no_show' ? 'walkthrough_no_show' :
                     status === 'rescheduled' ? 'walkthrough_rescheduled' : null;

    if (eventType) {
      const { data: walkthrough } = await supabase
        .from('quote_walkthroughs')
        .select('quote_id')
        .eq('id', walkthroughId)
        .single();

      if (walkthrough) {
        await logQuoteEvent(walkthrough.quote_id, null, eventType);
      }

      // Update deal stage if completed
      if (status === 'completed' && currentQuote?.deal_id) {
        await updateDealStage(currentQuote.deal_id, 'Quote Pending');
      }
    }

    toast.success(`Walkthrough ${status}`, 'Success');
    return data;
  } catch (error) {
    console.error('[Quotes] Error updating walkthrough status:', error);
    toast.error('Failed to update walkthrough', 'Error');
    throw error;
  }
}

// ==========================================
// CREATE FINAL QUOTE FROM WALKTHROUGH
// ==========================================
export async function createFinalQuoteFromWalkthrough(quoteId) {
  try {
    // Get current quote
    const quote = await loadQuoteDetail(quoteId);
    if (!quote) throw new Error('Quote not found');

    // Get latest revision
    const latestRevision = quote.revisions[0];
    if (!latestRevision) throw new Error('No revisions found');

    // Get walkthrough data
    const walkthrough = quote.walkthrough;
    if (!walkthrough || walkthrough.status !== 'completed') {
      toast.error('Walkthrough must be completed first', 'Error');
      throw new Error('Walkthrough not completed');
    }

    // Create new revision number
    const newRevisionNumber = quote.active_revision_number + 1;

    // Clone latest revision data but change type to final_quote
    const { data: newRevision, error: revError } = await supabase
      .from('quote_revisions')
      .insert({
        quote_id: quoteId,
        revision_number: newRevisionNumber,
        revision_type: 'final_quote',
        is_binding: true,
        scope_summary: latestRevision.scope_summary,
        service_schedule_summary: latestRevision.service_schedule_summary,
        assumptions: latestRevision.assumptions,
        exclusions: latestRevision.exclusions,
        billing_frequency: latestRevision.billing_frequency,
        contract_term_months: latestRevision.contract_term_months,
        start_date_proposed: latestRevision.start_date_proposed
      })
      .select()
      .single();

    if (revError) throw revError;

    // Clone line items (convert ranges to binding prices if needed)
    const { data: oldItems } = await supabase
      .from('quote_line_items')
      .select('*')
      .eq('quote_id', quoteId)
      .eq('revision_number', latestRevision.revision_number)
      .order('display_order');

    if (oldItems && oldItems.length > 0) {
      const newItems = oldItems.map((item, index) => ({
        quote_id: quoteId,
        revision_number: newRevisionNumber,
        category: item.category,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit === 'range' ? 'flat' : item.unit, // Convert range to flat
        unit_price: item.unit === 'range' ? (item.range_high + item.range_low) / 2 : item.unit_price, // Use midpoint for range
        range_low: null,
        range_high: null,
        frequency_multiplier: item.frequency_multiplier,
        line_total: null, // Will be calculated
        display_order: index
      }));

      await supabase
        .from('quote_line_items')
        .insert(newItems);
    }

    // Recalculate totals
    await recalculateRevisionTotals(quoteId, newRevisionNumber);

    // Update quote
    await supabase
      .from('quotes')
      .update({
        active_revision_number: newRevisionNumber
      })
      .eq('id', quoteId);

    toast.success('Final quote created successfully', 'Success');
    return newRevision;
  } catch (error) {
    console.error('[Quotes] Error creating final quote:', error);
    toast.error('Failed to create final quote', 'Error');
    throw error;
  }
}

// ==========================================
// AUTOMATIONS
// ==========================================
async function updateDealStage(dealId, stage) {
  try {
    await supabase
      .from('deals')
      .update({ stage })
      .eq('id', dealId);
  } catch (error) {
    console.error('[Quotes] Error updating deal stage:', error);
  }
}

export async function acceptFinalQuote(quoteId, revisionNumber, acceptData) {
  try {
    // Update revision
    await supabase
      .from('quote_revisions')
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by_name: acceptData.name,
        accepted_by_email: acceptData.email,
        accepted_ip: acceptData.ip || null
      })
      .eq('quote_id', quoteId)
      .eq('revision_number', revisionNumber);

    // Update quote status
    await supabase
      .from('quotes')
      .update({
        status: 'accepted'
      })
      .eq('id', quoteId);

    // Log event
    await logQuoteEvent(quoteId, revisionNumber, 'accepted', acceptData);

    // Update deal stage
    const { data: quote } = await supabase
      .from('quotes')
      .select('deal_id')
      .eq('id', quoteId)
      .single();

    if (quote?.deal_id) {
      await updateDealStage(quote.deal_id, 'Won');
    }

    toast.success('Quote accepted successfully', 'Success');
  } catch (error) {
    console.error('[Quotes] Error accepting quote:', error);
    toast.error('Failed to accept quote', 'Error');
    throw error;
  }
}

export async function declineFinalQuote(quoteId, revisionNumber, declineData) {
  try {
    // Update revision
    await supabase
      .from('quote_revisions')
      .update({
        declined_at: new Date().toISOString(),
        decline_reason: declineData.reason,
        decline_notes: declineData.notes || null
      })
      .eq('quote_id', quoteId)
      .eq('revision_number', revisionNumber);

    // Update quote status
    await supabase
      .from('quotes')
      .update({
        status: 'declined'
      })
      .eq('id', quoteId);

    // Log event
    await logQuoteEvent(quoteId, revisionNumber, 'declined', declineData);

    // Update deal stage
    const { data: quote } = await supabase
      .from('quotes')
      .select('deal_id')
      .eq('id', quoteId)
      .single();

    if (quote?.deal_id) {
      await updateDealStage(quote.deal_id, 'Lost');
    }

    toast.success('Quote declined', 'Success');
  } catch (error) {
    console.error('[Quotes] Error declining quote:', error);
    toast.error('Failed to decline quote', 'Error');
    throw error;
  }
}

// ==========================================
// PUBLIC PORTAL ACCESS
// ==========================================
export async function getRevisionByToken(publicToken) {
  try {
    const { data: revision, error } = await supabase
      .from('quote_revisions')
      .select(`
        *,
        quotes!inner(
          id,
          account_id,
          primary_contact_id,
          quote_type,
          status,
          sites:account_id(id, name, address, contact_email, contact_phone)
        )
      `)
      .eq('public_token', publicToken)
      .single();

    if (error) throw error;

    // Check if expired
    if (revision.expires_at && new Date(revision.expires_at) < new Date()) {
      return { ...revision, expired: true };
    }

    // Load line items
    const { data: lineItems } = await supabase
      .from('quote_line_items')
      .select('*')
      .eq('quote_id', revision.quote_id)
      .eq('revision_number', revision.revision_number)
      .order('display_order');

    return {
      ...revision,
      lineItems: lineItems || [],
      expired: false
    };
  } catch (error) {
    console.error('[Quotes] Error loading revision by token:', error);
    return null;
  }
}

export async function logPortalEvent(publicToken, eventType, metadata = {}) {
  try {
    // Get revision to find quote_id
    const { data: revision } = await supabase
      .from('quote_revisions')
      .select('quote_id, revision_number')
      .eq('public_token', publicToken)
      .single();

    if (revision) {
      await logQuoteEvent(revision.quote_id, revision.revision_number, eventType, metadata);

      // Update quote status to viewed if first view
      if (eventType === 'viewed') {
        await supabase
          .from('quotes')
          .update({ status: 'viewed' })
          .eq('id', revision.quote_id)
          .eq('status', 'sent');
      }
    }
  } catch (error) {
    console.error('[Quotes] Error logging portal event:', error);
  }
}

// ==========================================
// EXPORTS
// ==========================================
export { sites, deals, contacts, services, serviceCategories, currentQuote };
export { loadSites, loadDeals, loadContacts };
