/**
 * Accounts Service Module
 * Handles accounts, contacts, and sites CRUD operations
 */

import { supabase } from './supabase.js';

/**
 * List accounts with search, filters, and sorting
 */
export async function listAccounts({ search, filters = {}, sort = 'last_touch_at_desc', limit = 100, offset = 0 } = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let query = supabase
      .from('accounts')
      .select(`
        *,
        owner:user_profiles!accounts_owner_user_id_fkey(id, full_name, email),
        dm_contact:account_contacts!accounts_dm_contact_id_fkey(id, full_name, title, phone, email)
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
      query = query.or(`name.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`);
    }

    // Apply status filter
    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    // Apply owner filter (for managers)
    if (filters.owner_user_id) {
      query = query.eq('owner_user_id', filters.owner_user_id);
    }

    // Apply sites count filter
    if (filters.sites) {
      if (filters.sites === '1') {
        query = query.eq('site_count', 1);
      } else if (filters.sites === '2-5') {
        query = query.gte('site_count', 2).lte('site_count', 5);
      } else if (filters.sites === '6+') {
        query = query.gte('site_count', 6);
      }
    }

    // Apply sorting
    switch (sort) {
      case 'last_touch_at_desc':
        query = query.order('last_touch_at', { ascending: false, nullsFirst: false });
        break;
      case 'site_count_desc':
        query = query.order('site_count', { ascending: false });
        break;
      case 'name_asc':
        query = query.order('name', { ascending: true });
        break;
      default:
        query = query.order('last_touch_at', { ascending: false, nullsFirst: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) throw error;

    // Fetch user profiles separately to avoid foreign key issues
    if (data && data.length > 0) {
      const ownerIds = [...new Set(data.map(a => a.owner_user_id).filter(Boolean))];
      if (ownerIds.length > 0) {
        const { data: owners } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', ownerIds);
        
        if (owners) {
          const ownerMap = new Map(owners.map(o => [o.id, o]));
          data.forEach(account => {
            if (account.owner_user_id && ownerMap.has(account.owner_user_id)) {
              account.owner = ownerMap.get(account.owner_user_id);
            }
          });
        }
      }

      // Fetch DM contacts
      const dmIds = data.map(a => a.dm_contact_id).filter(Boolean);
      if (dmIds.length > 0) {
        const { data: dmContacts } = await supabase
          .from('account_contacts')
          .select('id, full_name, title, phone, email')
          .in('id', dmIds);
        
        if (dmContacts) {
          const dmMap = new Map(dmContacts.map(c => [c.id, c]));
          data.forEach(account => {
            if (account.dm_contact_id && dmMap.has(account.dm_contact_id)) {
              account.dm_contact = dmMap.get(account.dm_contact_id);
            }
          });
        }
      }
    }

    return data || [];
  } catch (error) {
    console.error('[Accounts] Error listing accounts:', error);
    throw error;
  }
}

/**
 * Get account detail with contacts and sites
 */
export async function getAccountDetail(accountId) {
  try {
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (accountError) throw accountError;

    // Fetch owner
    if (account.owner_user_id) {
      const { data: owner } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .eq('id', account.owner_user_id)
        .single();
      account.owner = owner || null;
    }

    // Fetch DM contact
    if (account.dm_contact_id) {
      const { data: dmContact } = await supabase
        .from('account_contacts')
        .select('*')
        .eq('id', account.dm_contact_id)
        .single();
      account.dm_contact = dmContact || null;
    }

    // Fetch all contacts
    const { data: contacts } = await supabase
      .from('account_contacts')
      .select('*')
      .eq('account_id', accountId)
      .order('is_primary', { ascending: false })
      .order('full_name', { ascending: true });

    account.contacts = contacts || [];

    // Fetch all sites
    const { data: sites } = await supabase
      .from('account_sites')
      .select('*')
      .eq('account_id', accountId)
      .order('name', { ascending: true });

    account.sites = sites || [];

    return account;
  } catch (error) {
    console.error('[Accounts] Error getting account detail:', error);
    throw error;
  }
}

/**
 * Create account
 */
export async function createAccount(accountData) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const account = {
      name: accountData.name,
      status: accountData.status || 'prospect',
      owner_user_id: accountData.owner_user_id || user.id,
      hq_address: accountData.hq_address || null,
      city: accountData.city || null,
      site_count: 0,
      contact_count: 0
    };

    const { data, error } = await supabase
      .from('accounts')
      .insert(account)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Accounts] Error creating account:', error);
    throw error;
  }
}

/**
 * Update account
 */
export async function updateAccount(accountId, updates) {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .update({
        name: updates.name,
        status: updates.status,
        owner_user_id: updates.owner_user_id,
        hq_address: updates.hq_address,
        city: updates.city,
        last_touch_at: updates.last_touch_at ? new Date(updates.last_touch_at).toISOString() : null
      })
      .eq('id', accountId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Accounts] Error updating account:', error);
    throw error;
  }
}

/**
 * Set decision maker for account
 */
export async function setDecisionMaker(accountId, contactId) {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .update({ dm_contact_id: contactId })
      .eq('id', accountId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Accounts] Error setting decision maker:', error);
    throw error;
  }
}

/**
 * List contacts for account
 */
export async function listContactsByAccount(accountId) {
  try {
    const { data, error } = await supabase
      .from('account_contacts')
      .select('*')
      .eq('account_id', accountId)
      .order('is_primary', { ascending: false })
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Accounts] Error listing contacts:', error);
    throw error;
  }
}

/**
 * Create contact
 */
export async function createContact(contactData) {
  try {
    const { data, error } = await supabase
      .from('account_contacts')
      .insert({
        account_id: contactData.account_id,
        full_name: contactData.full_name,
        title: contactData.title || null,
        phone: contactData.phone || null,
        email: contactData.email || null,
        role_tag: contactData.role_tag || 'other',
        is_primary: contactData.is_primary || false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Accounts] Error creating contact:', error);
    throw error;
  }
}

/**
 * Update contact
 */
export async function updateContact(contactId, updates) {
  try {
    const { data, error } = await supabase
      .from('account_contacts')
      .update({
        full_name: updates.full_name,
        title: updates.title,
        phone: updates.phone,
        email: updates.email,
        role_tag: updates.role_tag,
        is_primary: updates.is_primary
      })
      .eq('id', contactId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Accounts] Error updating contact:', error);
    throw error;
  }
}

/**
 * Delete contact
 */
export async function deleteContact(contactId) {
  try {
    const { error } = await supabase
      .from('account_contacts')
      .delete()
      .eq('id', contactId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[Accounts] Error deleting contact:', error);
    throw error;
  }
}

/**
 * List sites for account
 */
export async function listSitesByAccount(accountId) {
  try {
    const { data, error } = await supabase
      .from('account_sites')
      .select('*')
      .eq('account_id', accountId)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Accounts] Error listing sites:', error);
    throw error;
  }
}

/**
 * Create site
 */
export async function createSite(siteData) {
  try {
    const { data, error } = await supabase
      .from('account_sites')
      .insert({
        account_id: siteData.account_id,
        name: siteData.name || null,
        address: siteData.address,
        city: siteData.city || null,
        lat: siteData.lat || null,
        lng: siteData.lng || null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Accounts] Error creating site:', error);
    throw error;
  }
}

/**
 * Update site
 */
export async function updateSite(siteId, updates) {
  try {
    const { data, error } = await supabase
      .from('account_sites')
      .update({
        name: updates.name,
        address: updates.address,
        city: updates.city,
        lat: updates.lat,
        lng: updates.lng
      })
      .eq('id', siteId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Accounts] Error updating site:', error);
    throw error;
  }
}

/**
 * Delete site
 */
export async function deleteSite(siteId) {
  try {
    const { error } = await supabase
      .from('account_sites')
      .delete()
      .eq('id', siteId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[Accounts] Error deleting site:', error);
    throw error;
  }
}
