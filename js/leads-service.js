/**
 * Leads Service Module
 * Handles leads CRUD operations and filtering
 */

import { supabase } from './supabase.js';

/**
 * List leads with search, filters, and sorting
 */
export async function listLeads({ search, filters = {}, sort = 'next_action_at_asc', limit = 100, offset = 0 } = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let query = supabase
      .from('leads')
      .select(`
        *,
        owner:user_profiles!leads_owner_user_id_fkey(id, full_name, email)
      `);

    // Apply owner filter (reps see their own, managers see all)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile && !['admin', 'manager', 'client'].includes(profile.role)) {
      query = query.eq('owner_user_id', user.id);
    }

    // Apply search
    if (search && search.trim()) {
      const searchTerm = search.trim();
      query = query.or(`company_name.ilike.%${searchTerm}%,person_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }

    // Apply status filter
    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    // Apply source filter
    if (filters.source && filters.source.length > 0) {
      query = query.in('source', filters.source);
    }

    // Apply owner filter (for managers)
    if (filters.owner_user_id) {
      query = query.eq('owner_user_id', filters.owner_user_id);
    }

    // Apply priority filter
    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }

    // Apply has phone filter
    if (filters.has_phone === 'yes') {
      query = query.not('phone', 'is', null);
    } else if (filters.has_phone === 'no') {
      query = query.is('phone', null);
    }

    // Apply sorting
    switch (sort) {
      case 'next_action_at_asc':
        query = query.order('next_action_at', { ascending: true, nullsFirst: false });
        break;
      case 'last_touch_at_desc':
        query = query.order('last_touch_at', { ascending: false, nullsFirst: false });
        break;
      case 'priority_desc':
        query = query.order('priority', { ascending: false });
        break;
      case 'created_at_desc':
        query = query.order('created_at', { ascending: false });
        break;
      default:
        query = query.order('next_action_at', { ascending: true, nullsFirst: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) throw error;

    // Fetch user profiles separately to avoid foreign key issues
    if (data && data.length > 0) {
      const ownerIds = [...new Set(data.map(l => l.owner_user_id).filter(Boolean))];
      if (ownerIds.length > 0) {
        const { data: owners } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', ownerIds);
        
        if (owners) {
          const ownerMap = new Map(owners.map(o => [o.id, o]));
          data.forEach(lead => {
            if (lead.owner_user_id && ownerMap.has(lead.owner_user_id)) {
              lead.owner = ownerMap.get(lead.owner_user_id);
            }
          });
        }
      }
    }

    return data || [];
  } catch (error) {
    console.error('[Leads] Error listing leads:', error);
    throw error;
  }
}

/**
 * Get lead detail with activities
 */
export async function getLeadDetail(leadId) {
  try {
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError) throw leadError;

    // Fetch owner
    if (lead.owner_user_id) {
      const { data: owner } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .eq('id', lead.owner_user_id)
        .single();
      lead.owner = owner || null;
    }

    // Fetch recent activities (last 10)
    const { data: activities } = await supabase
      .from('lead_activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('timestamp', { ascending: false })
      .limit(10);

    lead.activities = activities || [];

    // Fetch linked account if converted
    if (lead.account_id) {
      const { data: account } = await supabase
        .from('accounts')
        .select('id, name')
        .eq('id', lead.account_id)
        .single();
      lead.account = account || null;
    }

    // Fetch linked contact if converted
    if (lead.contact_id) {
      const { data: contact } = await supabase
        .from('account_contacts')
        .select('id, full_name, phone, email')
        .eq('id', lead.contact_id)
        .single();
      lead.contact = contact || null;
    }

    // Fetch linked deal if converted
    if (lead.deal_id) {
      const { data: deal } = await supabase
        .from('deals')
        .select('id, name, stage')
        .eq('id', lead.deal_id)
        .single();
      lead.deal = deal || null;
    }

    return lead;
  } catch (error) {
    console.error('[Leads] Error getting lead detail:', error);
    throw error;
  }
}

/**
 * Create lead
 */
export async function createLead(leadData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const lead = {
      company_name: leadData.company_name || null,
      person_name: leadData.person_name || null,
      title: leadData.title || null,
      phone: leadData.phone || null,
      email: leadData.email || null,
      address: leadData.address || null,
      city: leadData.city || null,
      lat: leadData.lat || null,
      lng: leadData.lng || null,
      source: leadData.source || 'other',
      status: 'new',
      owner_user_id: leadData.owner_user_id || user.id,
      priority: leadData.priority || 3,
      attempts_count: 0,
      notes_lite: leadData.notes_lite || null
    };

    const { data, error } = await supabase
      .from('leads')
      .insert(lead)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Leads] Error creating lead:', error);
    throw error;
  }
}

/**
 * Update lead
 */
export async function updateLead(leadId, updates) {
  try {
    const { data, error } = await supabase
      .from('leads')
      .update({
        company_name: updates.company_name,
        person_name: updates.person_name,
        title: updates.title,
        phone: updates.phone,
        email: updates.email,
        address: updates.address,
        city: updates.city,
        lat: updates.lat,
        lng: updates.lng,
        source: updates.source,
        status: updates.status,
        owner_user_id: updates.owner_user_id,
        priority: updates.priority,
        last_touch_at: updates.last_touch_at ? new Date(updates.last_touch_at).toISOString() : null,
        next_action_at: updates.next_action_at ? new Date(updates.next_action_at).toISOString() : null,
        attempts_count: updates.attempts_count,
        notes_lite: updates.notes_lite
      })
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Leads] Error updating lead:', error);
    throw error;
  }
}

/**
 * Update lead status and create activity (disposition)
 */
export async function updateLeadStatusAndDisposition(leadId, outcome, nextActionAt = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get current lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError) throw leadError;

    // Map outcome to status
    let newStatus = lead.status;
    if (outcome === 'dm_reached') {
      newStatus = 'dm_reached';
    } else if (outcome === 'booked_walkthrough') {
      newStatus = 'walkthrough_booked';
    } else if (outcome === 'do_not_contact') {
      newStatus = 'do_not_contact';
    } else if (outcome === 'not_interested') {
      newStatus = 'unqualified';
    } else if (lead.status === 'new') {
      newStatus = 'contacted';
    }

    // Calculate next action time based on outcome
    let calculatedNextActionAt = nextActionAt;
    if (!calculatedNextActionAt && outcome) {
      const now = new Date();
      if (outcome === 'no_answer') {
        calculatedNextActionAt = new Date(now.getTime() + 4 * 60 * 60 * 1000); // +4 hours
      } else if (outcome === 'gatekeeper') {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0); // Tomorrow 10am
        calculatedNextActionAt = tomorrow.toISOString();
      } else if (outcome === 'dm_reached') {
        calculatedNextActionAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // +24 hours
      } else if (outcome === 'booked_walkthrough') {
        // Clear or set to walkthrough time - handled by nextActionAt param
        calculatedNextActionAt = nextActionAt || null;
      } else if (['not_interested', 'wrong_number', 'do_not_contact'].includes(outcome)) {
        calculatedNextActionAt = null;
      }
    }

    // Update lead
    const updates = {
      status: newStatus,
      last_touch_at: new Date().toISOString(),
      attempts_count: (lead.attempts_count || 0) + 1,
      next_action_at: calculatedNextActionAt ? new Date(calculatedNextActionAt).toISOString() : null
    };

    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Create activity record
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        type: 'call',
        outcome: outcome,
        timestamp: new Date().toISOString(),
        metadata: {}
      });

    return updatedLead;
  } catch (error) {
    console.error('[Leads] Error updating lead status:', error);
    throw error;
  }
}

/**
 * Set lead next action time
 */
export async function setLeadNextAction(leadId, nextActionAt) {
  try {
    const { data, error } = await supabase
      .from('leads')
      .update({
        next_action_at: nextActionAt ? new Date(nextActionAt).toISOString() : null
      })
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Leads] Error setting next action:', error);
    throw error;
  }
}

/**
 * Reassign lead owner
 */
export async function reassignLeadOwner(leadId, ownerUserId) {
  try {
    const { data, error } = await supabase
      .from('leads')
      .update({ owner_user_id: ownerUserId })
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Leads] Error reassigning owner:', error);
    throw error;
  }
}

/**
 * Convert lead to account/contact/deal
 */
export async function convertLead(leadId, payload) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError) throw leadError;

    let accountId = payload.account_id || null;
    let contactId = payload.contact_id || null;
    let dealId = payload.deal_id || null;

    // Create or link account
    if (!accountId && payload.create_account !== false) {
      // Check for existing account with similar name
      if (lead.company_name) {
        const { data: existingAccounts } = await supabase
          .from('accounts')
          .select('id, name')
          .ilike('name', `%${lead.company_name}%`)
          .limit(5);

        // If user selected an existing account, use it
        if (payload.existing_account_id) {
          accountId = payload.existing_account_id;
        } else if (existingAccounts && existingAccounts.length === 1) {
          // Auto-link if exactly one match
          accountId = existingAccounts[0].id;
        } else {
          // Create new account
          const { data: newAccount, error: accountError } = await supabase
            .from('accounts')
            .insert({
              name: lead.company_name,
              status: 'prospect',
              owner_user_id: lead.owner_user_id || user.id,
              hq_address: lead.address,
              city: lead.city
            })
            .select()
            .single();

          if (accountError) throw accountError;
          accountId = newAccount.id;
        }
      }
    } else if (payload.existing_account_id) {
      accountId = payload.existing_account_id;
    }

    // Create contact if person_name/phone/email exist
    if (accountId && (lead.person_name || lead.phone || lead.email) && !contactId && payload.create_contact !== false) {
      const { data: newContact, error: contactError } = await supabase
        .from('account_contacts')
        .insert({
          account_id: accountId,
          full_name: lead.person_name || 'Contact',
          title: lead.title,
          phone: lead.phone,
          email: lead.email,
          role_tag: 'decision_maker',
          is_primary: true
        })
        .select()
        .single();

      if (contactError) throw contactError;
      contactId = newContact.id;

      // Set as DM
      await supabase
        .from('accounts')
        .update({ dm_contact_id: contactId })
        .eq('id', accountId);
    }

    // Create deal if requested (default ON when status is dm_reached or walkthrough_booked)
    if (payload.create_deal && accountId && !dealId) {
      const { data: newDeal, error: dealError } = await supabase
        .from('deals')
        .insert({
          account_id: accountId, // Note: deals.account_id references sites(id), may need adjustment
          primary_contact_id: contactId,
          owner_user_id: lead.owner_user_id || user.id,
          name: `${lead.company_name || lead.person_name || 'Deal'} - ${new Date().getFullYear()}`,
          stage: 'prospecting',
          is_closed: false
        })
        .select()
        .single();

      if (dealError) {
        console.warn('[Leads] Deal creation failed (may be expected if deals table uses different schema):', dealError);
      } else {
        dealId = newDeal.id;
      }
    } else if (payload.existing_deal_id) {
      dealId = payload.existing_deal_id;
    }

    // Update lead with conversion links
    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update({
        account_id: accountId,
        contact_id: contactId,
        deal_id: dealId,
        status: lead.status === 'walkthrough_booked' || lead.status === 'dm_reached' ? lead.status : 'contacted'
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) throw updateError;

    return {
      lead: updatedLead,
      account_id: accountId,
      contact_id: contactId,
      deal_id: dealId
    };
  } catch (error) {
    console.error('[Leads] Error converting lead:', error);
    throw error;
  }
}

/**
 * Create activity for lead
 */
export async function createLeadActivity(leadId, activityData) {
  try {
    const { data, error } = await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        type: activityData.type,
        outcome: activityData.outcome || null,
        timestamp: activityData.timestamp || new Date().toISOString(),
        duration_seconds: activityData.duration_seconds || null,
        metadata: activityData.metadata || {}
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Leads] Error creating activity:', error);
    throw error;
  }
}
