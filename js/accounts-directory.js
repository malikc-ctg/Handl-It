/**
 * Accounts Directory Module
 * Handles the Accounts Directory UI for Sales -> Contacts page
 */

import { supabase } from './supabase.js';
import { toast } from './notifications.js';
import * as accountsService from './accounts-service.js';
import { createSkeletonTableRows, createEmptyState } from './skeleton.js';

let currentUser = null;
let currentUserProfile = null;
let currentAccount = null;
let accounts = [];
let allReps = [];
let activeAccountMenu = null;
let activeContactMenu = null;

// Get current user and profile
async function getCurrentUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    currentUser = user;
    
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    currentUserProfile = profile;
    return { user, profile };
  } catch (error) {
    console.error('[Accounts] Error getting current user:', error);
    return null;
  }
}

// Load all reps for filter dropdown (managers only)
async function loadReps() {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .in('role', ['admin', 'manager', 'client'])
      .order('full_name', { ascending: true });
    
    if (error) throw error;
    allReps = data || [];
  } catch (error) {
    console.error('[Accounts] Error loading reps:', error);
  }
}

// Load accounts and standalone contacts
async function loadAccounts() {
  const tbody = document.getElementById('accounts-table-body');
  if (!tbody) {
    console.warn('[Accounts] Table body not found');
    return;
  }

  try {
    console.log('[Accounts] Loading accounts and contacts...');
    tbody.innerHTML = createSkeletonTableRows(5, 8);
    const search = document.getElementById('accounts-search')?.value || '';
    const statusFilter = document.getElementById('accounts-status-filter')?.value || '';
    const ownerFilter = document.getElementById('accounts-owner-filter')?.value || '';
    const sitesFilter = document.getElementById('accounts-sites-filter')?.value || '';
    const sortBy = document.getElementById('accounts-sort')?.value || 'last_touch_at_desc';

    const filters = {};
    if (statusFilter) filters.status = [statusFilter];
    if (ownerFilter) filters.owner_user_id = ownerFilter;
    if (sitesFilter) filters.sites = sitesFilter;

    // Load accounts
    accounts = await accountsService.listAccounts({
      search,
      filters,
      sort: sortBy
    });

    // Also load standalone contacts
    let standaloneContacts = [];
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        let contactsQuery = supabase
          .from('contacts')
          .select('*')
          .order('created_at', { ascending: false });

        // Apply search to contacts
        if (search && search.trim()) {
          const searchTerm = search.trim();
          contactsQuery = contactsQuery.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,normalized_phone.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%`);
        }

        const { data: contacts, error: contactsError } = await contactsQuery;
        
        if (contactsError) {
          console.warn('[Accounts] Could not load standalone contacts:', contactsError);
        } else {
          standaloneContacts = contacts || [];
          console.log('[Accounts] Standalone contacts loaded:', standaloneContacts.length);
        }
      }
    } catch (error) {
      console.warn('[Accounts] Error loading standalone contacts:', error);
    }

    console.log('[Accounts] Accounts loaded:', accounts?.length || 0);
    console.log('[Accounts] Contacts loaded:', standaloneContacts?.length || 0);
    
    // Combine accounts and contacts for rendering
    window.allAccountsAndContacts = {
      accounts: accounts || [],
      contacts: standaloneContacts || []
    };
    
    renderAccounts();
  } catch (error) {
    console.error('[Accounts] Error loading accounts:', error);
    // Clear loading state and show error
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="px-4 py-12 text-center">
            <i data-lucide="alert-circle" class="w-16 h-16 mx-auto text-red-300 mb-4"></i>
            <p class="text-red-600 dark:text-red-400 font-medium mb-2">Failed to load accounts</p>
            <p class="text-sm text-gray-500 mb-4">${error.message || 'Unknown error occurred'}</p>
            <button onclick="window.accountsDirectory?.loadAccounts()" class="px-4 py-2 bg-nfgblue hover:bg-nfgdark text-white rounded-xl font-medium transition inline-flex items-center gap-2">
              <i data-lucide="refresh-cw" class="w-4 h-4"></i> Retry
            </button>
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons();
    }
    toast.error(`Failed to load accounts: ${error.message}`, 'Error');
    accounts = []; // Set to empty array so renderAccounts doesn't break
    window.allAccountsAndContacts = { accounts: [], contacts: [] };
  }
}

// Render accounts and contacts table
function renderAccounts() {
  const tbody = document.getElementById('accounts-table-body');
  if (!tbody) return;

  const allItems = window.allAccountsAndContacts || { accounts: accounts || [], contacts: [] };
  const totalItems = allItems.accounts.length + allItems.contacts.length;

  if (totalItems === 0) {
    const emptyHtml = createEmptyState({
      icon: 'building-2',
      title: 'No accounts or contacts yet',
      message: 'Create your first account or contact to get started.',
      actionLabel: 'Create Account or Contact',
      actionId: 'create-account-btn-empty',
      bordered: true
    });
    tbody.innerHTML = `<tr><td colspan="8" class="p-0 align-top">${emptyHtml}</td></tr>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Render accounts
  const accountsHTML = allItems.accounts.map(account => {
    const dmContact = account.dm_contact;
    const statusBadges = {
      prospect: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Prospect</span>',
      in_progress: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">In Progress</span>',
      active: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Active Client</span>',
      dormant: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Dormant</span>'
    };
    
    const statusBadge = statusBadges[account.status] || statusBadges.prospect;
    const dmName = dmContact ? `${dmContact.full_name}${dmContact.title ? ` - ${dmContact.title}` : ''}` : 'No DM set';
    const dmPhone = dmContact?.phone || '';
    const dmEmail = dmContact?.email || '';
    const ownerName = account.owner?.full_name || 'Unassigned';
    const lastTouch = account.last_touch_at ? new Date(account.last_touch_at).toLocaleDateString() : '—';

    return `
      <tr class="account-row hover:bg-nfglight cursor-pointer border-b border-nfgray" data-account-id="${account.id}" data-type="account">
        <td class="px-4 py-3">
          <div class="flex items-center gap-2">
            <i data-lucide="building-2" class="w-4 h-4 text-gray-400"></i>
            <div>
              <div class="font-medium text-nfgblue dark:text-blue-400">${escapeHtml(account.name)}</div>
              ${account.city ? `<div class="text-sm text-gray-500">${escapeHtml(account.city)}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="px-4 py-3">
          <div class="text-sm">${escapeHtml(dmName)}</div>
          ${!dmContact ? `<button class="text-xs text-nfgblue hover:underline set-dm-btn" data-account-id="${account.id}">Set DM</button>` : ''}
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-2">
            ${dmPhone ? `<a href="tel:${dmPhone}" class="text-gray-600 hover:text-nfgblue" onclick="event.stopPropagation()"><i data-lucide="phone" class="w-4 h-4"></i></a>` : '<span class="text-gray-400"><i data-lucide="phone" class="w-4 h-4"></i></span>'}
            ${dmEmail ? `<a href="mailto:${dmEmail}" class="text-gray-600 hover:text-nfgblue" onclick="event.stopPropagation()"><i data-lucide="mail" class="w-4 h-4"></i></a>` : '<span class="text-gray-400"><i data-lucide="mail" class="w-4 h-4"></i></span>'}
          </div>
        </td>
        <td class="px-4 py-3">
          <span class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">${account.site_count || 0} sites</span>
        </td>
        <td class="px-4 py-3">${statusBadge}</td>
        <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(ownerName)}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${lastTouch}</td>
        <td class="px-4 py-3">
          <div class="relative">
            <button class="account-actions-btn p-1 rounded hover:bg-nfgray" data-account-id="${account.id}" type="button">
              <i data-lucide="more-vertical" class="w-4 h-4"></i>
            </button>
            <!-- Dropdown Menu -->
            <div 
              class="account-actions-menu fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 min-w-[150px] z-[9999] hidden"
              data-account-id="${account.id}"
            >
              <button 
                class="account-action-btn edit-account-btn w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2.5 whitespace-nowrap"
                data-action="edit" 
                data-account-id="${account.id}"
                type="button"
                onclick="window.accountsDirectory?.handleAccountAction('edit', '${account.id}'); event.stopPropagation();"
              >
                <i data-lucide="edit" class="w-4 h-4 flex-shrink-0"></i>
                <span class="flex-1">Edit</span>
              </button>
              <button 
                class="account-action-btn delete-account-btn w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2.5 whitespace-nowrap"
                data-action="delete" 
                data-account-id="${account.id}"
                type="button"
                onclick="window.accountsDirectory?.handleAccountAction('delete', '${account.id}'); event.stopPropagation();"
              >
                <i data-lucide="trash-2" class="w-4 h-4 flex-shrink-0"></i>
                <span class="flex-1">Delete</span>
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Render standalone contacts
  const contactsHTML = allItems.contacts.map(contact => {
    const fullName = contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown';
    const phone = contact.normalized_phone || contact.phone || '';
    const email = contact.email || '';
    const company = contact.company_name || '';
    const city = contact.city || '';
    const title = contact.title || '';
    const lastTouch = contact.last_contacted_at ? new Date(contact.last_contacted_at).toLocaleDateString() : (contact.created_at ? new Date(contact.created_at).toLocaleDateString() : '—');
    
    // No-contact streak badge
    const noContactStreak = contact.no_contact_streak || 0;
    let streakBadge = '';
    if (noContactStreak >= 2) {
      streakBadge = `<span class="px-1.5 py-0.5 text-xs font-bold rounded bg-red-500 text-white animate-pulse ml-1" title="2 no-contacts - final attempt!">⚠️ 2/3</span>`;
    } else if (noContactStreak === 1) {
      streakBadge = `<span class="px-1.5 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-700 ml-1" title="1 no-contact">1/3</span>`;
    }
    
    // Contact status badge
    const statusBadges = {
      new: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">New</span>',
      active: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Active</span>',
      nurturing: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">Nurturing</span>',
      lost: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Lost</span>',
      converted: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-green-500 text-white">Converted</span>'
    };
    const contactStatus = contact.contact_status || 'new';
    const statusBadge = statusBadges[contactStatus] || statusBadges.new;

    return `
      <tr class="contact-row hover:bg-nfglight cursor-pointer border-b border-nfgray ${noContactStreak >= 2 ? 'bg-red-50 dark:bg-red-900/10' : noContactStreak === 1 ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}" data-contact-id="${contact.id}" data-type="contact">
        <td class="px-4 py-3">
          <div class="flex items-center gap-2">
            <i data-lucide="user" class="w-4 h-4 text-gray-400"></i>
            <div>
              <div class="font-medium text-nfgblue dark:text-blue-400 flex items-center">
                ${escapeHtml(fullName)}
                ${streakBadge}
              </div>
              ${city ? `<div class="text-sm text-gray-500">${escapeHtml(city)}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="px-4 py-3">
          <div class="text-sm">${escapeHtml(title || '—')}</div>
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-2">
            ${phone ? `<a href="tel:${phone}" class="text-gray-600 hover:text-nfgblue" onclick="event.stopPropagation()"><i data-lucide="phone" class="w-4 h-4"></i></a>` : '<span class="text-gray-400"><i data-lucide="phone" class="w-4 h-4"></i></span>'}
            ${email ? `<a href="mailto:${email}" class="text-gray-600 hover:text-nfgblue" onclick="event.stopPropagation()"><i data-lucide="mail" class="w-4 h-4"></i></a>` : '<span class="text-gray-400"><i data-lucide="mail" class="w-4 h-4"></i></span>'}
          </div>
        </td>
        <td class="px-4 py-3">
          <span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Contact</span>
        </td>
        <td class="px-4 py-3">
          ${statusBadge}
        </td>
        <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(company || '—')}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${lastTouch}</td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-1">
            <button 
              class="log-activity-btn p-1.5 rounded bg-green-100 hover:bg-green-200 text-green-700" 
              data-contact-id="${contact.id}" 
              type="button"
              title="Log Activity"
              onclick="window.openLogActivityForContact && window.openLogActivityForContact('${contact.id}'); event.stopPropagation();">
              <i data-lucide="phone-call" class="w-4 h-4"></i>
            </button>
            <div class="relative">
              <button class="contact-actions-btn p-1 rounded hover:bg-nfgray" data-contact-id="${contact.id}" type="button">
                <i data-lucide="more-vertical" class="w-4 h-4"></i>
              </button>
              <!-- Dropdown Menu -->
              <div 
                class="contact-actions-menu fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 min-w-[150px] z-[9999] hidden"
                data-contact-id="${contact.id}">
                <button 
                  class="contact-action-btn log-activity-menu-btn w-full text-left px-4 py-2.5 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors flex items-center gap-2.5 whitespace-nowrap"
                  data-action="log-activity" 
                  data-contact-id="${contact.id}"
                  type="button"
                  onclick="window.openLogActivityForContact && window.openLogActivityForContact('${contact.id}'); event.stopPropagation();">
                  <i data-lucide="phone-call" class="w-4 h-4 flex-shrink-0"></i>
                  <span class="flex-1">Log Activity</span>
                </button>
                <button 
                  class="contact-action-btn edit-contact-btn w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2.5 whitespace-nowrap"
                  data-action="edit" 
                  data-contact-id="${contact.id}"
                  type="button"
                  onclick="window.accountsDirectory?.handleContactAction('edit', '${contact.id}'); event.stopPropagation();">
                  <i data-lucide="edit" class="w-4 h-4 flex-shrink-0"></i>
                  <span class="flex-1">Edit</span>
                </button>
                <button 
                  class="contact-action-btn delete-contact-btn w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2.5 whitespace-nowrap"
                  data-action="delete" 
                  data-contact-id="${contact.id}"
                  type="button"
                  onclick="window.accountsDirectory?.handleContactAction('delete', '${contact.id}'); event.stopPropagation();">
                  <i data-lucide="trash-2" class="w-4 h-4 flex-shrink-0"></i>
                  <span class="flex-1">Delete</span>
                </button>
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = accountsHTML + contactsHTML;

  if (window.lucide) lucide.createIcons();
  
  // Attach event listeners to action buttons after rendering
  attachAccountActionListeners();
  attachContactActionListeners();
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Open account drawer
async function openAccountDrawer(accountId) {
  try {
    const drawer = document.getElementById('account-drawer');
    const backdrop = document.getElementById('account-drawer-backdrop');
    if (!drawer) {
      console.error('[Accounts] Account drawer not found in DOM');
      toast.error('Account drawer not available', 'Error');
      return;
    }

    currentAccount = await accountsService.getAccountDetail(accountId);
    renderAccountDrawer();
    drawer.classList.remove('hidden');
    drawer.style.display = 'block';
    if (backdrop) backdrop.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    console.log('[Accounts] Account drawer opened for:', currentAccount?.name);
  } catch (error) {
    console.error('[Accounts] Error opening account drawer:', error);
    toast.error('Failed to load account details', 'Error');
  }
}

// Close account drawer
function closeAccountDrawer() {
  const drawer = document.getElementById('account-drawer');
  const backdrop = document.getElementById('account-drawer-backdrop');
  if (drawer) {
    drawer.classList.add('hidden');
    drawer.style.display = '';
  }
  if (backdrop) backdrop.classList.add('hidden');
  currentAccount = null;
}

// Open contact detail modal (view mode) - Enhanced with Sales Flow
async function openContactDetailModal(contactId) {
  try {
    // Fetch fresh data from database to get all tracking fields
    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();
    
    if (error || !contact) {
      toast.error('Contact not found', 'Error');
      return;
    }
    
    // Populate the detail modal
    const modal = document.getElementById('contact-detail-modal');
    if (!modal) {
      console.error('[Accounts] Contact detail modal not found');
      await openEditContactModal(contactId);
      return;
    }
    
    const fullName = contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown';
    const phone = contact.normalized_phone || contact.phone || '';
    const email = contact.email || '';
    const company = contact.company_name || '';
    const city = contact.city || '';
    const title = contact.title || '';
    const address = contact.street_address || contact.address || '';
    
    // Update basic info
    document.getElementById('detail-contact-name').textContent = fullName;
    document.getElementById('detail-contact-title').textContent = title || 'No title';
    document.getElementById('detail-contact-company').textContent = company || 'No company';
    document.getElementById('detail-contact-location').textContent = [city, address].filter(Boolean).join(', ') || 'No location';
    
    // Phone
    const phoneEl = document.getElementById('detail-contact-phone');
    if (phoneEl) {
      if (phone) {
        phoneEl.innerHTML = `<a href="tel:${phone}" class="text-nfgblue hover:underline">${escapeHtml(phone)}</a>`;
      } else {
        phoneEl.textContent = 'No phone';
      }
    }
    
    // Email
    const emailEl = document.getElementById('detail-contact-email');
    if (emailEl) {
      if (email) {
        emailEl.innerHTML = `<a href="mailto:${email}" class="text-nfgblue hover:underline">${escapeHtml(email)}</a>`;
      } else {
        emailEl.textContent = 'No email';
      }
    }
    
    // === SALES STATUS ===
    const statusEl = document.getElementById('detail-contact-status');
    const statusBadges = {
      new: { class: 'bg-blue-100 text-blue-800', text: 'New' },
      active: { class: 'bg-green-100 text-green-800', text: 'Active' },
      nurturing: { class: 'bg-purple-100 text-purple-800', text: 'Nurturing' },
      lost: { class: 'bg-red-100 text-red-800', text: 'Lost' },
      converted: { class: 'bg-green-500 text-white', text: 'Converted' }
    };
    const contactStatus = contact.contact_status || 'new';
    const badge = statusBadges[contactStatus] || statusBadges.new;
    if (statusEl) {
      statusEl.className = `px-3 py-1 text-sm font-medium rounded-full ${badge.class}`;
      statusEl.textContent = badge.text;
    }
    
    // === NO-CONTACT STREAK ===
    const streakEl = document.getElementById('detail-contact-streak');
    const streak = contact.no_contact_streak || 0;
    if (streakEl) {
      if (streak >= 2) {
        streakEl.className = 'ml-2 px-2 py-1 text-xs font-bold rounded bg-red-500 text-white animate-pulse';
        streakEl.textContent = '⚠️ 2/3 - FINAL ATTEMPT';
        streakEl.classList.remove('hidden');
      } else if (streak === 1) {
        streakEl.className = 'ml-2 px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-700';
        streakEl.textContent = '1/3 no-contact';
        streakEl.classList.remove('hidden');
      } else {
        streakEl.classList.add('hidden');
      }
    }
    
    // === QUICK STATS ===
    const attemptsEl = document.getElementById('detail-contact-attempts');
    const connectedEl = document.getElementById('detail-contact-connected');
    const daysEl = document.getElementById('detail-contact-days');
    
    if (attemptsEl) attemptsEl.textContent = contact.total_contact_attempts || 0;
    
    // Calculate days idle
    const lastTouch = contact.last_contacted_at || contact.last_contact_attempt_at || contact.created_at;
    if (daysEl && lastTouch) {
      const days = Math.floor((new Date() - new Date(lastTouch)) / (1000 * 60 * 60 * 24));
      daysEl.textContent = days;
    } else if (daysEl) {
      daysEl.textContent = '—';
    }
    
    // === NEXT FOLLOW-UP ===
    const followupSection = document.getElementById('detail-next-followup-section');
    const followupEl = document.getElementById('detail-next-followup');
    if (contact.next_follow_up_date && followupSection && followupEl) {
      const followupDate = new Date(contact.next_follow_up_date);
      const isOverdue = followupDate < new Date();
      followupSection.classList.remove('hidden');
      followupEl.textContent = `${contact.next_follow_up_type || 'Call'}: ${followupDate.toLocaleDateString()} ${followupDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
      if (isOverdue) {
        followupSection.className = 'mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg';
        followupEl.textContent = `OVERDUE - ${followupEl.textContent}`;
      }
    } else if (followupSection) {
      followupSection.classList.add('hidden');
    }
    
    // === LOAD ACTIVITY TIMELINE ===
    await loadContactActivityTimeline(contactId, contact);
    
    // === SETUP CALL BUTTON ===
    const callBtn = document.getElementById('detail-call-btn');
    if (callBtn) {
      if (phone) {
        callBtn.onclick = () => window.open(`tel:${phone}`, '_self');
        callBtn.disabled = false;
        callBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        callBtn.disabled = true;
        callBtn.classList.add('opacity-50', 'cursor-not-allowed');
        callBtn.onclick = null;
      }
    }
    
    // === SETUP LOG ACTIVITY BUTTON ===
    const logBtn = document.getElementById('detail-log-activity-btn');
    if (logBtn) {
      logBtn.onclick = () => {
        if (window.openLogActivityForContact) {
          window.openLogActivityForContact(contactId);
        }
      };
    }
    
    // Store contact ID and phone for actions
    modal.dataset.contactId = contactId;
    modal.dataset.contactPhone = phone;
    
    // Show modal
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  } catch (error) {
    console.error('[Accounts] Error opening contact detail modal:', error);
    toast.error('Failed to load contact details', 'Error');
  }
}

// Load activity timeline for a contact
async function loadContactActivityTimeline(contactId, contact) {
  const timelineEl = document.getElementById('detail-activity-timeline');
  if (!timelineEl) return;
  
  try {
    // Try to load activities from sales_activities table
    const { data: activities, error } = await supabase
      .from('sales_activities')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(20);
    
    // Count connected calls
    const connectedEl = document.getElementById('detail-contact-connected');
    if (connectedEl && activities) {
      const connected = activities.filter(a => a.outcome === 'connected' || a.outcome === 'scheduled_callback').length;
      connectedEl.textContent = connected;
    }
    
    if (error || !activities || activities.length === 0) {
      // No activities - show empty state with contact created date
      const createdDate = contact.created_at ? new Date(contact.created_at).toLocaleDateString() : 'Unknown';
      timelineEl.innerHTML = `
        <div class="relative pl-6 pb-4 border-l-2 border-green-300">
          <div class="absolute -left-2 top-0 w-4 h-4 bg-green-500 rounded-full"></div>
          <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
            <p class="text-xs text-green-600 dark:text-green-400 font-medium">CONTACT CREATED</p>
            <p class="text-sm text-gray-700 dark:text-gray-300">${createdDate}</p>
          </div>
        </div>
        <div class="text-center py-4 text-gray-400">
          <p class="text-sm">No call activities yet</p>
          <p class="text-xs">Click "Log Activity" to record your first call</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }
    
    // Render activities
    const outcomeIcons = {
      connected: { icon: 'check-circle', color: 'green', label: 'Connected' },
      no_answer: { icon: 'phone-missed', color: 'red', label: 'No Answer' },
      voicemail: { icon: 'voicemail', color: 'yellow', label: 'Left Voicemail' },
      scheduled_callback: { icon: 'calendar', color: 'blue', label: 'Callback Scheduled' },
      not_interested: { icon: 'x-circle', color: 'gray', label: 'Not Interested' },
      wrong_number: { icon: 'phone-off', color: 'gray', label: 'Wrong Number' }
    };
    
    const activityTypeIcons = {
      call: 'phone',
      email: 'mail',
      meeting: 'users',
      walkthrough: 'clipboard-check',
      quote: 'file-text',
      note: 'sticky-note'
    };
    
    let html = '';
    
    activities.forEach((activity, index) => {
      const outcome = outcomeIcons[activity.outcome] || { icon: 'activity', color: 'gray', label: activity.outcome };
      const typeIcon = activityTypeIcons[activity.activity_type] || 'activity';
      const date = new Date(activity.created_at);
      const isLast = index === activities.length - 1;
      
      html += `
        <div class="relative pl-6 pb-4 ${!isLast ? 'border-l-2 border-gray-200 dark:border-gray-600' : ''}">
          <div class="absolute -left-2 top-0 w-4 h-4 bg-${outcome.color}-500 rounded-full flex items-center justify-center">
            <i data-lucide="${outcome.icon}" class="w-2.5 h-2.5 text-white"></i>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-medium text-${outcome.color}-600 dark:text-${outcome.color}-400 uppercase flex items-center gap-1">
                <i data-lucide="${typeIcon}" class="w-3 h-3"></i>
                ${activity.activity_type || 'Call'} - ${outcome.label}
              </span>
              <span class="text-xs text-gray-400">${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
            ${activity.notes ? `<p class="text-sm text-gray-600 dark:text-gray-300">${escapeHtml(activity.notes)}</p>` : ''}
            ${activity.next_action_date ? `<p class="text-xs text-blue-600 mt-1"><i data-lucide="calendar" class="w-3 h-3 inline"></i> Follow-up: ${new Date(activity.next_action_date).toLocaleDateString()}</p>` : ''}
          </div>
        </div>
      `;
    });
    
    // Add contact created entry at the end
    if (contact.created_at) {
      html += `
        <div class="relative pl-6">
          <div class="absolute -left-2 top-0 w-4 h-4 bg-green-500 rounded-full"></div>
          <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
            <p class="text-xs text-green-600 dark:text-green-400 font-medium">CONTACT CREATED</p>
            <p class="text-sm text-gray-700 dark:text-gray-300">${new Date(contact.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      `;
    }
    
    timelineEl.innerHTML = html;
    if (window.lucide) lucide.createIcons();
    
  } catch (error) {
    console.warn('[Accounts] Could not load activity timeline:', error);
    timelineEl.innerHTML = `
      <div class="text-center py-4 text-gray-400">
        <p class="text-sm">Could not load activities</p>
      </div>
    `;
  }
}

// Close contact detail modal
function closeContactDetailModal() {
  const modal = document.getElementById('contact-detail-modal');
  if (modal) modal.classList.add('hidden');
}

// Open edit contact modal
async function openEditContactModal(contactId) {
  try {
    const allItems = window.allAccountsAndContacts || { contacts: [] };
    const contact = allItems.contacts.find(c => c.id === contactId);
    
    if (!contact) {
      // Try to fetch from database if not in cache
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();
      
      if (error || !data) {
        toast.error('Contact not found', 'Error');
        return;
      }
      
      // Populate form with contact data
      populateEditContactForm(data);
    } else {
      // Populate form with contact data
      populateEditContactForm(contact);
    }
    
    // Show modal
    const modal = document.getElementById('edit-contact-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      modal.style.visibility = 'visible';
      modal.style.opacity = '1';
      if (window.lucide) lucide.createIcons();
      console.log('[Accounts] Edit contact modal opened');
    } else {
      console.error('[Accounts] Edit contact modal not found in DOM');
    }
  } catch (error) {
    console.error('[Accounts] Error opening edit contact modal:', error);
    toast.error('Failed to load contact details', 'Error');
  }
}

// Populate edit contact form
function populateEditContactForm(contact) {
  document.getElementById('edit-contact-id').value = contact.id || '';
  document.getElementById('edit-first-name').value = contact.first_name || '';
  document.getElementById('edit-last-name').value = contact.last_name || '';
  document.getElementById('edit-email').value = contact.email || '';
  document.getElementById('edit-phone').value = contact.normalized_phone || contact.phone || '';
  document.getElementById('edit-title').value = contact.title || '';
  document.getElementById('edit-company-name').value = contact.company_name || '';
  document.getElementById('edit-address').value = contact.street_address || contact.address || '';
  document.getElementById('edit-city').value = contact.city || '';
}

// Close edit contact modal
function closeEditContactModal() {
  const modal = document.getElementById('edit-contact-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = '';
  }
  
  // Reset form
  const form = document.getElementById('edit-contact-form');
  if (form) form.reset();
}

// Render account drawer content
function renderAccountDrawer() {
  if (!currentAccount) return;

  // Company Summary
  const companySection = document.getElementById('drawer-company-summary');
  if (companySection) {
    const statusBadges = {
      prospect: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Prospect</span>',
      in_progress: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">In Progress</span>',
      active: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Active Client</span>',
      dormant: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Dormant</span>'
    };
    
    companySection.innerHTML = `
      <div>
        <h3 class="text-lg font-semibold text-nfgblue dark:text-blue-400">${escapeHtml(currentAccount.name)}</h3>
        <div class="mt-2 flex items-center gap-2">
          ${statusBadges[currentAccount.status] || statusBadges.prospect}
          <span class="text-sm text-gray-500">•</span>
          <span class="text-sm text-gray-600">${escapeHtml(currentAccount.owner?.full_name || 'Unassigned')}</span>
        </div>
        ${currentAccount.hq_address ? `<p class="mt-2 text-sm text-gray-600">${escapeHtml(currentAccount.hq_address)}</p>` : ''}
        <div class="mt-3">
          <span class="text-sm font-medium">${currentAccount.site_count || 0} sites</span>
          <button id="drawer-view-all-sites" class="ml-2 text-sm text-nfgblue hover:underline">View all</button>
        </div>
      </div>
      <div class="flex gap-2 mt-4">
        <button onclick="window.openAddSiteModal()" class="px-3 py-2 text-sm bg-nfgblue hover:bg-nfgdark text-white rounded-lg">Add Site</button>
        <button onclick="window.openAddContactModal()" class="px-3 py-2 text-sm border border-nfgray hover:bg-nfglight dark:hover:bg-gray-700 rounded-lg">Add Contact</button>
        <button onclick="window.openEditAccountModal()" class="px-3 py-2 text-sm border border-nfgray hover:bg-nfglight dark:hover:bg-gray-700 rounded-lg">Edit</button>
      </div>
    `;
  }

  // Decision Maker
  const dmSection = document.getElementById('drawer-decision-maker');
  if (dmSection) {
    if (currentAccount.dm_contact) {
      const dm = currentAccount.dm_contact;
      dmSection.innerHTML = `
        <div class="p-4 border border-nfgray dark:border-gray-700 rounded-xl">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <h4 class="font-medium text-nfgblue dark:text-blue-400">${escapeHtml(dm.full_name)}</h4>
              ${dm.title ? `<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${escapeHtml(dm.title)}</p>` : ''}
              <div class="mt-2 flex items-center gap-3">
                ${dm.phone ? `<a href="tel:${dm.phone}" class="text-sm text-gray-600 dark:text-gray-400 hover:text-nfgblue flex items-center gap-1"><i data-lucide="phone" class="w-4 h-4"></i> ${escapeHtml(dm.phone)}</a>` : ''}
                ${dm.email ? `<a href="mailto:${dm.email}" class="text-sm text-gray-600 dark:text-gray-400 hover:text-nfgblue flex items-center gap-1"><i data-lucide="mail" class="w-4 h-4"></i> ${escapeHtml(dm.email)}</a>` : ''}
              </div>
            </div>
            <button onclick="window.openSetDMModal()" class="px-3 py-1 text-sm border border-nfgray dark:border-gray-600 hover:bg-nfglight dark:hover:bg-gray-700 rounded-lg">Change DM</button>
          </div>
        </div>
      `;
    } else {
      dmSection.innerHTML = `
        <div class="p-4 border border-nfgray dark:border-gray-700 rounded-xl text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">No decision maker set</p>
          <button onclick="window.openSetDMModal()" class="px-4 py-2 bg-nfgblue hover:bg-nfgdark text-white rounded-lg">Set Decision Maker</button>
        </div>
      `;
    }
  }

  // Contacts list
  const contactsSection = document.getElementById('drawer-contacts-list');
  if (contactsSection) {
    if (!currentAccount.contacts || currentAccount.contacts.length === 0) {
      contactsSection.innerHTML = '<p class="text-sm text-gray-500">No contacts yet</p>';
    } else {
      contactsSection.innerHTML = currentAccount.contacts.map(contact => {
        const roleTags = {
          decision_maker: '<span class="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800">DM</span>',
          admin: '<span class="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-800">Admin</span>',
          facilities: '<span class="px-2 py-0.5 text-xs rounded bg-green-100 text-green-800">Facilities</span>',
          billing: '<span class="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-800">Billing</span>',
          other: '<span class="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-800">Other</span>'
        };
        
        return `
          <div class="flex items-start justify-between p-3 border border-nfgray rounded-lg">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="font-medium">${escapeHtml(contact.full_name)}</span>
                ${roleTags[contact.role_tag] || roleTags.other}
              </div>
              ${contact.title ? `<p class="text-sm text-gray-600 mt-1">${escapeHtml(contact.title)}</p>` : ''}
              <div class="mt-1 flex items-center gap-3">
                ${contact.phone ? `<a href="tel:${contact.phone}" class="text-sm text-gray-600 hover:text-nfgblue"><i data-lucide="phone" class="w-3 h-3 inline"></i></a>` : ''}
                ${contact.email ? `<a href="mailto:${contact.email}" class="text-sm text-gray-600 hover:text-nfgblue"><i data-lucide="mail" class="w-3 h-3 inline"></i></a>` : ''}
              </div>
            </div>
            <button class="set-dm-from-list-btn px-2 py-1 text-xs border border-nfgray hover:bg-nfglight rounded" data-contact-id="${contact.id}">Set as DM</button>
          </div>
        `;
      }).join('');
    }
  }

  // Sites list
  const sitesSection = document.getElementById('drawer-sites-list');
  if (sitesSection) {
    if (!currentAccount.sites || currentAccount.sites.length === 0) {
      sitesSection.innerHTML = '<p class="text-sm text-gray-500">No sites yet</p>';
    } else {
      const displaySites = currentAccount.sites.slice(0, 5);
      const moreCount = currentAccount.sites.length - 5;
      sitesSection.innerHTML = displaySites.map(site => `
        <div class="flex items-start justify-between p-3 border border-nfgray rounded-lg">
          <div class="flex-1">
            <div class="font-medium">${escapeHtml(site.name || 'Unnamed Site')}</div>
            <p class="text-sm text-gray-600 mt-1">${escapeHtml(site.address)}</p>
          </div>
          <button class="edit-site-btn px-2 py-1 text-xs border border-nfgray hover:bg-nfglight rounded" data-site-id="${site.id}">Edit</button>
        </div>
      `).join('') + (moreCount > 0 ? `<p class="text-sm text-gray-500 mt-2">+${moreCount} more sites</p>` : '');
    }
  }

  if (window.lucide) lucide.createIcons();
}

// Initialize accounts directory
async function initAccountsDirectory() {
  try {
    console.log('[Accounts] ===== Initializing accounts directory =====');
    console.log('[Accounts] Step 1: Checking DOM elements...');
    
    // Check if table body exists
    const tbody = document.getElementById('accounts-table-body');
    if (!tbody) {
      console.warn('[Accounts] Table body not found, waiting for DOM...');
      // Wait a bit and try again
      await new Promise(resolve => setTimeout(resolve, 200));
      const retryTbody = document.getElementById('accounts-table-body');
      if (!retryTbody) {
        console.error('[Accounts] ❌ Table body still not found after retry');
        console.error('[Accounts] Available elements:', {
          contactsTab: !!document.getElementById('tab-contacts'),
          searchInput: !!document.getElementById('accounts-search'),
          tableBody: !!document.getElementById('accounts-table-body')
        });
        return;
      }
      console.log('[Accounts] ✓ Table body found on retry');
    } else {
      console.log('[Accounts] ✓ Table body found');
    }
    
    console.log('[Accounts] Step 2: Getting current user...');
    await getCurrentUser();
    console.log('[Accounts] ✓ Current user:', currentUser?.email || 'not found');
    
    // Load reps if manager/admin
    if (currentUserProfile && ['admin', 'manager', 'client'].includes(currentUserProfile.role)) {
      console.log('[Accounts] Step 3: Loading reps...');
      await loadReps();
      console.log('[Accounts] ✓ Reps loaded:', allReps.length);
    } else {
      console.log('[Accounts] Step 3: Skipping reps (not manager/admin)');
    }

    console.log('[Accounts] Step 4: Setting up event listeners...');
    // Setup event listeners (idempotent - safe to call multiple times)
    setupEventListeners();
    console.log('[Accounts] ✓ Event listeners set up');
    
    console.log('[Accounts] Step 5: Loading accounts...');
    // Load accounts
    await loadAccounts();
    
    console.log('[Accounts] ===== Accounts directory initialized successfully =====');
  } catch (error) {
    console.error('[Accounts] ❌ Error initializing accounts directory:', error);
    console.error('[Accounts] Error stack:', error.stack);
    toast.error(`Failed to initialize accounts directory: ${error.message}`, 'Error');
    
    // Try to show error in table
    const tbody = document.getElementById('accounts-table-body');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="px-4 py-12 text-center">
            <i data-lucide="alert-circle" class="w-16 h-16 mx-auto text-red-300 mb-4"></i>
            <p class="text-red-600 dark:text-red-400 font-medium mb-2">Initialization Error</p>
            <p class="text-sm text-gray-500 mb-4">${error.message || 'Unknown error'}</p>
            <button onclick="window.accountsDirectory?.init()" class="px-4 py-2 bg-nfgblue hover:bg-nfgdark text-white rounded-xl font-medium transition inline-flex items-center gap-2">
              <i data-lucide="refresh-cw" class="w-4 h-4"></i> Retry
            </button>
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons();
    }
  }
}

// Setup event listeners
function setupEventListeners() {
  // Search
  const searchInput = document.getElementById('accounts-search');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => loadAccounts(), 300);
    });
  }

  // Filters
  document.querySelectorAll('#accounts-status-filter input, #accounts-owner-filter, #accounts-sites-filter, #accounts-sort').forEach(el => {
    el.addEventListener('change', loadAccounts);
  });

  // Create account button - use event delegation for reliability
  document.addEventListener('click', (e) => {
    if (e.target.closest('#create-account-btn, #create-account-btn-empty, #new-account-btn-tab')) {
      e.preventDefault();
      e.stopPropagation();
      const modal = document.getElementById('create-account-modal');
      if (modal) {
        modal.classList.remove('hidden');
        // Re-initialize lucide icons in case they weren't loaded
        if (window.lucide) {
          lucide.createIcons();
        }
      } else {
        console.error('[Accounts] Create account modal not found');
      }
    }
  });

  // Close create account modal
  const closeCreateAccountModal = () => {
    const modal = document.getElementById('create-account-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  };
  document.getElementById('create-account-close')?.addEventListener('click', closeCreateAccountModal);
  document.getElementById('create-account-cancel')?.addEventListener('click', closeCreateAccountModal);

  // Contact detail modal handlers
  document.getElementById('contact-detail-close')?.addEventListener('click', closeContactDetailModal);
  document.getElementById('contact-detail-edit-btn')?.addEventListener('click', async () => {
    const modal = document.getElementById('contact-detail-modal');
    const contactId = modal?.dataset.contactId;
    if (contactId) {
      closeContactDetailModal();
      await openEditContactModal(contactId);
    }
  });
  document.getElementById('contact-detail-delete-btn')?.addEventListener('click', async () => {
    const modal = document.getElementById('contact-detail-modal');
    const contactId = modal?.dataset.contactId;
    if (contactId) {
      closeContactDetailModal();
      await handleContactAction('delete', contactId);
    }
  });

  // Edit contact modal handlers
  document.getElementById('edit-contact-close')?.addEventListener('click', closeEditContactModal);
  document.getElementById('edit-contact-cancel')?.addEventListener('click', closeEditContactModal);
  
  // Edit contact form submission
  const editContactForm = document.getElementById('edit-contact-form');
  if (editContactForm) {
    let isSubmitting = false;
    
    editContactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (isSubmitting) {
        console.log('[Accounts] Edit form submission already in progress, ignoring...');
        return;
      }
      
      isSubmitting = true;
      const submitBtn = editContactForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn?.textContent;
      
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
      }
      
      try {
        const formData = new FormData(e.target);
        const contactId = formData.get('contact_id');
        
        if (!contactId) {
          toast.error('Contact ID is missing', 'Error');
          isSubmitting = false;
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText || 'Save Changes';
          }
          return;
        }
        
        const firstName = formData.get('first_name')?.trim();
        const lastName = formData.get('last_name')?.trim();
        
        if (!firstName || !lastName) {
          toast.error('First name and last name are required', 'Error');
          isSubmitting = false;
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText || 'Save Changes';
          }
          return;
        }
        
        await accountsService.updateStandaloneContact(contactId, {
          first_name: firstName,
          last_name: lastName,
          email: formData.get('email')?.trim() || null,
          phone: formData.get('phone')?.trim() || null,
          title: formData.get('title')?.trim() || null,
          company_name: formData.get('company_name')?.trim() || null,
          address: formData.get('address')?.trim() || null,
          city: formData.get('city')?.trim() || null
        });
        
        toast.success('Contact updated successfully', 'Success');
        closeEditContactModal();
        await loadAccounts();
      } catch (error) {
        console.error('[Accounts] Error updating contact:', error);
        toast.error(`Failed to update contact: ${error.message}`, 'Error');
      } finally {
        isSubmitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText || 'Save Changes';
        }
      }
    });
  }

  // Account row click
  document.getElementById('accounts-table-body')?.addEventListener('click', (e) => {
    // Handle account row click
    const accountRow = e.target.closest('.account-row');
    if (accountRow && !e.target.closest('button, a')) {
      openAccountDrawer(accountRow.dataset.accountId);
      return;
    }
    
    // Handle contact row click
    const contactRow = e.target.closest('.contact-row');
    if (contactRow && !e.target.closest('button, a')) {
      openContactDetailModal(contactRow.dataset.contactId);
      return;
    }
  });

  // Account actions menu (three-dot menu)
  // Use event delegation on the table body for better reliability
  const accountsTableBody = document.getElementById('accounts-table-body');
  if (accountsTableBody) {
    accountsTableBody.addEventListener('click', (e) => {
      // Don't handle clicks on action menu buttons - let them bubble up
      if (e.target.closest('.account-action-btn') || e.target.closest('.account-actions-menu')) {
        return;
      }
      
      // Check if click is on the button or icon inside it
      let actionsBtn = e.target.closest('.account-actions-btn');
      
      // If clicked on icon, get the parent button
      if (!actionsBtn && e.target.closest('i[data-lucide="more-vertical"]')) {
        actionsBtn = e.target.closest('i[data-lucide="more-vertical"]').closest('.account-actions-btn');
      }
      
      if (actionsBtn) {
        e.stopPropagation();
        e.preventDefault();
        const accountId = actionsBtn.dataset.accountId;
        
        // Find the menu (next sibling div)
        let menu = actionsBtn.nextElementSibling;
        while (menu && !menu.classList.contains('account-actions-menu')) {
          menu = menu.nextElementSibling;
        }
        
        if (menu && menu.classList.contains('account-actions-menu')) {
          const isHidden = menu.classList.contains('hidden');
          
          // Close all menus first
          document.querySelectorAll('.account-actions-menu').forEach(m => {
            m.classList.add('hidden');
            m.style.top = '';
            m.style.left = '';
          });
          
          if (isHidden) {
            // Position menu relative to button
            const rect = actionsBtn.getBoundingClientRect();
            menu.style.position = 'fixed';
            menu.style.top = `${rect.bottom + 5}px`;
            menu.style.left = `${Math.max(10, rect.right - 150)}px`;
            menu.style.zIndex = '9999';
            menu.classList.remove('hidden');
            activeAccountMenu = menu;
            
            // Re-initialize icons
            if (window.lucide) {
              lucide.createIcons();
            }
          } else {
            activeAccountMenu = null;
          }
        }
      }
    });
  }
  
  // Contact actions menu (three-dot menu) - similar to account actions
  if (accountsTableBody) {
    accountsTableBody.addEventListener('click', (e) => {
      // Don't handle clicks on action menu buttons - let them bubble up
      if (e.target.closest('.contact-action-btn') || e.target.closest('.contact-actions-menu')) {
        return;
      }
      
      // Check if click is on the button or icon inside it
      let actionsBtn = e.target.closest('.contact-actions-btn');
      
      // If clicked on icon, get the parent button
      if (!actionsBtn && e.target.closest('i[data-lucide="more-vertical"]')) {
        actionsBtn = e.target.closest('i[data-lucide="more-vertical"]').closest('.contact-actions-btn');
      }
      
      if (actionsBtn) {
        e.stopPropagation();
        e.preventDefault();
        const contactId = actionsBtn.dataset.contactId;
        
        // Find the menu (next sibling div)
        let menu = actionsBtn.nextElementSibling;
        while (menu && !menu.classList.contains('contact-actions-menu')) {
          menu = menu.nextElementSibling;
        }
        
        if (menu && menu.classList.contains('contact-actions-menu')) {
          const isHidden = menu.classList.contains('hidden');
          
          // Close all menus first (both account and contact)
          document.querySelectorAll('.account-actions-menu, .contact-actions-menu').forEach(m => {
            m.classList.add('hidden');
            m.style.top = '';
            m.style.left = '';
          });
          
          if (isHidden) {
            // Position menu relative to button
            const rect = actionsBtn.getBoundingClientRect();
            menu.style.position = 'fixed';
            menu.style.top = `${rect.bottom + 5}px`;
            menu.style.left = `${Math.max(10, rect.right - 150)}px`;
            menu.style.zIndex = '9999';
            menu.classList.remove('hidden');
            activeContactMenu = menu;
            activeAccountMenu = null; // Clear account menu
            
            // Re-initialize icons
            if (window.lucide) {
              lucide.createIcons();
            }
          } else {
            activeContactMenu = null;
          }
        }
      }
    });
  }

  // Close menu when clicking outside (but not on action buttons)
  document.addEventListener('click', (e) => {
    // Don't close if clicking on action buttons inside the menu
    if (e.target.closest('.account-action-btn') || e.target.closest('.contact-action-btn')) {
      return;
    }
    
    if (activeAccountMenu && 
        !e.target.closest('.account-actions-menu') && 
        !e.target.closest('.account-actions-btn')) {
      activeAccountMenu.classList.add('hidden');
      activeAccountMenu = null;
    }
    
    if (activeContactMenu && 
        !e.target.closest('.contact-actions-menu') && 
        !e.target.closest('.contact-actions-btn')) {
      activeContactMenu.classList.add('hidden');
      activeContactMenu = null;
    }
  });

  // Handle account action buttons (edit, delete) - use event delegation as backup
  document.addEventListener('click', async (e) => {
    // Check if click is on action button or any child element (icon, span, etc.)
    const accountActionBtn = e.target.closest('.account-action-btn');
    if (accountActionBtn) {
      e.stopPropagation();
      e.preventDefault();
      
      const action = accountActionBtn.dataset.action;
      const accountId = accountActionBtn.dataset.accountId;
      
      console.log('[Accounts] Action button clicked via delegation:', { action, accountId });
      
      if (!action || !accountId) {
        console.warn('[Accounts] Missing action or accountId:', { action, accountId });
        return;
      }
      
      await handleAccountAction(action, accountId);
      return;
    }
    
    // Handle contact action buttons
    const contactActionBtn = e.target.closest('.contact-action-btn');
    if (contactActionBtn) {
      e.stopPropagation();
      e.preventDefault();
      
      const action = contactActionBtn.dataset.action;
      const contactId = contactActionBtn.dataset.contactId;
      
      console.log('[Accounts] Contact action button clicked via delegation:', { action, contactId });
      
      if (!action || !contactId) {
        console.warn('[Accounts] Missing action or contactId:', { action, contactId });
        return;
      }
      
      await handleContactAction(action, contactId);
      return;
    }
  });

  // Close drawer
  document.getElementById('account-drawer-close')?.addEventListener('click', closeAccountDrawer);

  // Set DM buttons
  document.addEventListener('click', async (e) => {
    if (e.target.closest('.set-dm-btn')) {
      const accountId = e.target.closest('.set-dm-btn').dataset.accountId;
      // Open set DM modal with account contacts
      const account = await accountsService.getAccountDetail(accountId);
      openSetDMModal(account);
    }
    
    if (e.target.closest('.set-dm-from-list-btn')) {
      const contactId = e.target.closest('.set-dm-from-list-btn').dataset.contactId;
      if (currentAccount) {
        await accountsService.setDecisionMaker(currentAccount.id, contactId);
        toast.success('Decision maker updated');
        await loadAccounts();
        await openAccountDrawer(currentAccount.id);
      }
    }
  });

  // Create account form
  // Contact type toggle
  let currentContactType = 'account'; // 'account' or 'contact'
  
  const accountTypeBtn = document.getElementById('contact-type-account');
  const contactTypeBtn = document.getElementById('contact-type-contact');
  const accountFields = document.getElementById('account-fields');
  const contactFields = document.getElementById('contact-fields');
  const modalTitle = document.getElementById('create-modal-title');
  const submitBtn = document.getElementById('create-submit-btn');

  function setContactType(type) {
    currentContactType = type;
    
    if (type === 'account') {
      // Account selected
      accountTypeBtn?.classList.remove('border-nfgray', 'dark:border-gray-600', 'bg-white', 'dark:bg-gray-800');
      accountTypeBtn?.classList.add('border-nfgblue', 'bg-nfgblue', 'text-white');
      contactTypeBtn?.classList.remove('border-nfgblue', 'bg-nfgblue', 'text-white');
      contactTypeBtn?.classList.add('border-nfgray', 'dark:border-gray-600', 'bg-white', 'dark:bg-gray-800');
      
      accountFields?.classList.remove('hidden');
      contactFields?.classList.add('hidden');
      
      if (modalTitle) modalTitle.textContent = 'Create Account';
      if (submitBtn) submitBtn.textContent = 'Create Account';
      
      // Update required fields
      const accountNameInput = createAccountForm?.querySelector('input[name="name"]');
      if (accountNameInput) accountNameInput.required = true;
      const firstNameInput = createAccountForm?.querySelector('input[name="first_name"]');
      if (firstNameInput) firstNameInput.required = false;
      const lastNameInput = createAccountForm?.querySelector('input[name="last_name"]');
      if (lastNameInput) lastNameInput.required = false;
    } else {
      // Contact selected
      contactTypeBtn?.classList.remove('border-nfgray', 'dark:border-gray-600', 'bg-white', 'dark:bg-gray-800');
      contactTypeBtn?.classList.add('border-nfgblue', 'bg-nfgblue', 'text-white');
      accountTypeBtn?.classList.remove('border-nfgblue', 'bg-nfgblue', 'text-white');
      accountTypeBtn?.classList.add('border-nfgray', 'dark:border-gray-600', 'bg-white', 'dark:bg-gray-800');
      
      accountFields?.classList.add('hidden');
      contactFields?.classList.remove('hidden');
      
      if (modalTitle) modalTitle.textContent = 'Create Contact';
      if (submitBtn) submitBtn.textContent = 'Create Contact';
      
      // Update required fields
      const accountNameInput = createAccountForm?.querySelector('input[name="name"]');
      if (accountNameInput) accountNameInput.required = false;
      const firstNameInput = createAccountForm?.querySelector('input[name="first_name"]');
      if (firstNameInput) firstNameInput.required = true;
      const lastNameInput = createAccountForm?.querySelector('input[name="last_name"]');
      if (lastNameInput) lastNameInput.required = true;
    }
  }

  accountTypeBtn?.addEventListener('click', () => setContactType('account'));
  contactTypeBtn?.addEventListener('click', () => setContactType('contact'));

  // Toggle Decision Maker fields
  const toggleDmBtn = document.getElementById('toggle-dm-fields');
  const dmFields = document.getElementById('dm-fields');
  if (toggleDmBtn && dmFields) {
    toggleDmBtn.addEventListener('click', () => {
      const isHidden = dmFields.classList.contains('hidden');
      if (isHidden) {
        dmFields.classList.remove('hidden');
        toggleDmBtn.innerHTML = '<i data-lucide="minus" class="w-3 h-3"></i> Hide';
      } else {
        dmFields.classList.add('hidden');
        toggleDmBtn.innerHTML = '<i data-lucide="plus" class="w-3 h-3"></i> Add Contact';
      }
      if (window.lucide) lucide.createIcons();
    });
  }

  const createAccountForm = document.getElementById('create-account-form');
  if (createAccountForm) {
    let isSubmitting = false;
    
    createAccountForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Prevent double submission
      if (isSubmitting) {
        console.log('[Accounts] Form submission already in progress, ignoring...');
        return;
      }
      
      isSubmitting = true;
      const submitBtn = createAccountForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn?.textContent;
      
      // Disable submit button
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
      }
      
      try {
        const formData = new FormData(e.target);
        
        if (currentContactType === 'account') {
          // Create Account
          const accountName = formData.get('name')?.trim();
          
          if (!accountName) {
            toast.error('Account name is required', 'Error');
            isSubmitting = false;
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = originalBtnText || 'Create Account';
            }
            return;
          }
          
          // Create the account with new fields
          const newAccount = await accountsService.createAccount({
            name: accountName,
            status: formData.get('status'),
            hq_address: formData.get('hq_address')?.trim() || null,
            city: formData.get('city')?.trim() || null,
            phone: formData.get('account_phone')?.trim() || null,
            email: formData.get('account_email')?.trim() || null,
            website: formData.get('website')?.trim() || null,
            industry: formData.get('industry') || null,
            notes: formData.get('notes')?.trim() || null
          });
          
          // Check if Decision Maker info was provided
          const dmFirstName = formData.get('dm_first_name')?.trim();
          const dmLastName = formData.get('dm_last_name')?.trim();
          const dmPhone = formData.get('dm_phone')?.trim();
          const dmEmail = formData.get('dm_email')?.trim();
          
          if (dmFirstName && dmLastName && (dmPhone || dmEmail) && newAccount?.id) {
            // Create Decision Maker contact linked to the account
            try {
              await accountsService.createContact({
                account_id: newAccount.id,
                full_name: `${dmFirstName} ${dmLastName}`,
                title: formData.get('dm_title')?.trim() || null,
                phone: dmPhone || null,
                email: dmEmail || null,
                role_tag: 'decision_maker'
              });
              toast.success('Account and Decision Maker created');
            } catch (dmError) {
              console.error('[Accounts] Error creating decision maker:', dmError);
              toast.success('Account created (Decision Maker failed)');
            }
          } else {
            toast.success('Account created');
          }
        } else {
          // Create Contact (standalone person)
          const firstName = formData.get('first_name')?.trim();
          const lastName = formData.get('last_name')?.trim();
          const email = formData.get('email')?.trim();
          const phone = formData.get('phone')?.trim();
          
          if (!firstName || !lastName) {
            toast.error('First name and last name are required', 'Error');
            isSubmitting = false;
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = originalBtnText || 'Create Contact';
            }
            return;
          }
          
          if (!email && !phone) {
            toast.error('Contact must have either an email or phone number', 'Error');
            isSubmitting = false;
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = originalBtnText || 'Create Contact';
            }
            return;
          }
          
          await accountsService.createStandaloneContact({
            first_name: firstName,
            last_name: lastName,
            email: email || null,
            phone: phone || null,
            title: formData.get('title')?.trim() || null,
            company_name: formData.get('company_name')?.trim() || null,
            address: formData.get('address')?.trim() || null,
            city: formData.get('contact_city')?.trim() || null
          });
          toast.success('Contact created');
        }
        
        const modal = document.getElementById('create-account-modal');
        if (modal) {
          modal.classList.add('hidden');
          modal.style.display = 'none';
        }
        e.target.reset();
        // Reset DM fields
        const dmFields = document.getElementById('dm-fields');
        if (dmFields) dmFields.classList.add('hidden');
        const toggleDmBtn = document.getElementById('toggle-dm-fields');
        if (toggleDmBtn) toggleDmBtn.innerHTML = '<i data-lucide="plus" class="w-3 h-3"></i> Add Contact';
        
        setContactType('account'); // Reset to account type
        await loadAccounts();
      } catch (error) {
        console.error('[Accounts] Error creating:', error);
        const errorMessage = error.message || `Failed to create ${currentContactType}`;
        toast.error(errorMessage, 'Error');
      } finally {
        isSubmitting = false;
        // Re-enable submit button
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText || 'Create';
        }
      }
    });
  }

  // Add contact form
  document.getElementById('add-contact-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentAccount) return;
    const formData = new FormData(e.target);
    try {
      await accountsService.createContact({
        account_id: currentAccount.id,
        full_name: formData.get('full_name'),
        title: formData.get('title'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        role_tag: formData.get('role_tag')
      });
      toast.success('Contact added');
      document.getElementById('add-contact-modal')?.classList.add('hidden');
      e.target.reset();
      await openAccountDrawer(currentAccount.id);
      await loadAccounts();
    } catch (error) {
      toast.error('Failed to add contact', 'Error');
    }
  });

  // Add site form
  document.getElementById('add-site-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentAccount) return;
    const formData = new FormData(e.target);
    try {
      await accountsService.createSite({
        account_id: currentAccount.id,
        name: formData.get('name'),
        address: formData.get('address'),
        city: formData.get('city')
      });
      toast.success('Site added');
      document.getElementById('add-site-modal')?.classList.add('hidden');
      e.target.reset();
      await openAccountDrawer(currentAccount.id);
      await loadAccounts();
    } catch (error) {
      toast.error('Failed to add site', 'Error');
    }
  });

  // Edit account form
  document.getElementById('edit-account-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentAccount) return;
    
    const formData = new FormData(e.target);
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }
    
    try {
      await accountsService.updateAccount(currentAccount.id, {
        name: formData.get('name')?.trim(),
        status: formData.get('status'),
        industry: formData.get('industry') || null,
        phone: formData.get('phone')?.trim() || null,
        email: formData.get('email')?.trim() || null,
        website: formData.get('website')?.trim() || null,
        hq_address: formData.get('hq_address')?.trim() || null,
        city: formData.get('city')?.trim() || null,
        notes: formData.get('notes')?.trim() || null
      });
      
      toast.success('Account updated successfully');
      document.getElementById('edit-account-modal')?.classList.add('hidden');
      await loadAccounts();
      // Refresh the drawer with updated data
      await openAccountDrawer(currentAccount.id);
    } catch (error) {
      console.error('[Accounts] Error updating account:', error);
      toast.error('Failed to update account: ' + (error.message || 'Unknown error'), 'Error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText || 'Save Changes';
      }
    }
  });
}

// Open set DM modal
function openSetDMModal(account) {
  const modal = document.getElementById('set-dm-modal');
  if (!modal) {
    console.error('[Accounts] Set DM modal not found');
    return;
  }
  
  const contactsList = document.getElementById('set-dm-contacts-list');
  if (contactsList) {
    if (!account.contacts || account.contacts.length === 0) {
      contactsList.innerHTML = `
        <div class="text-center py-4">
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">No contacts available.</p>
          <button onclick="document.getElementById('set-dm-modal').classList.add('hidden'); window.openAddContactModal();" class="text-sm text-nfgblue hover:underline">Add a contact first</button>
        </div>
      `;
    } else {
      contactsList.innerHTML = account.contacts.map(contact => `
        <button class="set-dm-contact-btn w-full text-left p-3 border border-nfgray dark:border-gray-600 rounded-lg hover:bg-nfglight dark:hover:bg-gray-700 transition" data-contact-id="${contact.id}">
          <div class="font-medium text-gray-900 dark:text-white">${escapeHtml(contact.full_name)}</div>
          ${contact.title ? `<div class="text-sm text-gray-600 dark:text-gray-400">${escapeHtml(contact.title)}</div>` : ''}
        </button>
      `).join('');
      
      // Setup contact selection with event delegation
      contactsList.onclick = async (e) => {
        const btn = e.target.closest('.set-dm-contact-btn');
        if (btn) {
          const contactId = btn.dataset.contactId;
          btn.disabled = true;
          btn.textContent = 'Setting...';
          try {
            await accountsService.setDecisionMaker(account.id, contactId);
            toast.success('Decision maker set');
            modal.classList.add('hidden');
            await loadAccounts();
            if (currentAccount && currentAccount.id === account.id) {
              await openAccountDrawer(account.id);
            }
          } catch (error) {
            console.error('[Accounts] Error setting DM:', error);
            toast.error('Failed to set decision maker', 'Error');
            btn.disabled = false;
          }
        }
      };
    }
  }

  modal.dataset.accountId = account.id;
  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

// Handle account actions (edit/delete)
async function handleAccountAction(action, accountId) {
  console.log('[Accounts] handleAccountAction called:', { action, accountId });
  
  // Close menu
  const menu = document.querySelector(`.account-actions-menu[data-account-id="${accountId}"]`);
  if (menu) {
    menu.classList.add('hidden');
    activeAccountMenu = null;
  }
  
  if (action === 'edit') {
    console.log('[Accounts] Opening account drawer for edit:', accountId);
    await openAccountDrawer(accountId);
  } else if (action === 'delete') {
    console.log('[Accounts] Delete action triggered for:', accountId);
    const account = accounts.find(a => a.id === accountId);
    if (!account) {
      toast.error('Account not found', 'Error');
      return;
    }
    
    if (confirm(`Are you sure you want to delete "${account.name}"? This action cannot be undone.`)) {
      try {
        console.log('[Accounts] Deleting account:', accountId);
        await accountsService.deleteAccount(accountId);
        toast.success('Account deleted successfully', 'Success');
        await loadAccounts();
      } catch (error) {
        console.error('[Accounts] Error deleting account:', error);
        toast.error(`Failed to delete account: ${error.message}`, 'Error');
      }
    }
  }
}

// Attach event listeners to action buttons
// Note: Using inline onclick handlers now, so this just ensures icons are rendered
function attachAccountActionListeners() {
  // Icons should already be rendered via lucide.createIcons()
  // Inline onclick handlers handle the click events
}

// Handle contact actions (edit, delete)
async function handleContactAction(action, contactId) {
  console.log('[Accounts] handleContactAction called:', { action, contactId });
  
  // Close menu
  const menu = document.querySelector(`.contact-actions-menu[data-contact-id="${contactId}"]`);
  if (menu) {
    menu.classList.add('hidden');
    activeContactMenu = null;
  }
  
  const allItems = window.allAccountsAndContacts || { contacts: [] };
  const contact = allItems.contacts.find(c => c.id === contactId);
  
  if (action === 'edit') {
    console.log('[Accounts] Opening contact edit modal:', contactId);
    await openEditContactModal(contactId);
  } else if (action === 'delete') {
    console.log('[Accounts] Delete action triggered for contact:', contactId);
    if (!contact) {
      toast.error('Contact not found', 'Error');
      return;
    }
    
    const contactName = contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown';
    
    if (confirm(`Are you sure you want to delete "${contactName}"? This action cannot be undone.`)) {
      try {
        console.log('[Accounts] Deleting contact:', contactId);
        await accountsService.deleteStandaloneContact(contactId);
        toast.success('Contact deleted successfully', 'Success');
        await loadAccounts();
      } catch (error) {
        console.error('[Accounts] Error deleting contact:', error);
        toast.error(`Failed to delete contact: ${error.message}`, 'Error');
      }
    }
  }
}

// Attach event listeners to contact action buttons
// Note: Using inline onclick handlers now, so this just ensures icons are rendered
function attachContactActionListeners() {
  // Icons should already be rendered via lucide.createIcons()
  // Inline onclick handlers handle the click events
}

// Global functions for drawer buttons
window.openAddSiteModal = function() {
  if (!currentAccount) {
    toast.error('No account selected', 'Error');
    return;
  }
  const modal = document.getElementById('add-site-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }
};

// Store available contacts for filtering
let availableContactsForLinking = [];

window.openAddContactModal = async function() {
  console.log('[Accounts] openAddContactModal called, currentAccount:', currentAccount?.name);
  
  if (!currentAccount) {
    toast.error('No account selected', 'Error');
    return;
  }
  
  const modal = document.getElementById('add-contact-modal');
  console.log('[Accounts] Add contact modal found:', !!modal);
  
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    console.log('[Accounts] Modal should be visible now');
    
    // Reset to existing tab
    switchAddContactTab('existing');
    
    // Clear search
    const searchInput = document.getElementById('existing-contact-search');
    if (searchInput) searchInput.value = '';
    
    // Load available contacts (standalone contacts not linked to this account)
    await loadAvailableContacts();
    
    if (window.lucide) lucide.createIcons();
  } else {
    console.error('[Accounts] add-contact-modal not found in DOM!');
  }
};

window.closeAddContactModal = function() {
  const modal = document.getElementById('add-contact-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = '';
  }
};

// Load contacts that can be linked to the account
async function loadAvailableContacts() {
  const listEl = document.getElementById('existing-contacts-list');
  if (!listEl) {
    console.error('[Accounts] existing-contacts-list element not found');
    return;
  }
  
  listEl.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Loading contacts...</p>';
  
  try {
    console.log('[Accounts] Loading available contacts...');
    
    // Get all contacts from the contacts table
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });
    
    console.log('[Accounts] Contacts query result:', { contacts: contacts?.length, error });
    
    if (error) throw error;
    
    // Filter out contacts already linked to this account (if account has contacts)
    const accountContactIds = (currentAccount?.contacts || []).map(c => c.id);
    console.log('[Accounts] Account contact IDs to exclude:', accountContactIds);
    
    availableContactsForLinking = (contacts || []).filter(c => !accountContactIds.includes(c.id));
    console.log('[Accounts] Available contacts after filtering:', availableContactsForLinking.length);
    
    renderAvailableContacts(availableContactsForLinking);
  } catch (error) {
    console.error('[Accounts] Error loading available contacts:', error);
    listEl.innerHTML = `<p class="text-sm text-red-500 text-center py-4">Failed to load contacts: ${error.message}</p>`;
  }
}

// Render available contacts list
function renderAvailableContacts(contacts) {
  const listEl = document.getElementById('existing-contacts-list');
  if (!listEl) {
    console.error('[Accounts] existing-contacts-list not found for rendering');
    return;
  }
  
  console.log('[Accounts] Rendering', contacts?.length || 0, 'contacts');
  
  if (!contacts || contacts.length === 0) {
    listEl.innerHTML = `
      <div class="text-center py-6">
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">No available contacts found</p>
        <button onclick="switchAddContactTab('new')" class="text-sm text-nfgblue hover:underline">Create a new contact</button>
      </div>
    `;
    return;
  }
  
  listEl.innerHTML = contacts.map(contact => {
    const name = contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown';
    const phone = contact.normalized_phone || contact.phone || '';
    const email = contact.email || '';
    const company = contact.company_name || '';
    
    return `
      <button onclick="linkExistingContact('${contact.id}')" class="w-full text-left p-3 border border-nfgray dark:border-gray-600 rounded-lg hover:bg-nfglight dark:hover:bg-gray-700 transition">
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <div class="font-medium text-gray-900 dark:text-white truncate">${escapeHtml(name)}</div>
            ${company ? `<div class="text-sm text-gray-600 dark:text-gray-400 truncate">${escapeHtml(company)}</div>` : ''}
            <div class="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
              ${phone ? `<span class="flex items-center gap-1"><i data-lucide="phone" class="w-3 h-3"></i> ${escapeHtml(phone)}</span>` : ''}
              ${email ? `<span class="flex items-center gap-1"><i data-lucide="mail" class="w-3 h-3"></i> ${escapeHtml(email)}</span>` : ''}
            </div>
          </div>
          <span class="text-xs text-nfgblue font-medium ml-2">Select</span>
        </div>
      </button>
    `;
  }).join('');
  
  if (window.lucide) lucide.createIcons();
}

// Filter existing contacts by search term
window.filterExistingContacts = function(searchTerm) {
  const term = searchTerm.toLowerCase().trim();
  if (!term) {
    renderAvailableContacts(availableContactsForLinking);
    return;
  }
  
  const filtered = availableContactsForLinking.filter(c => {
    const name = (c.full_name || `${c.first_name || ''} ${c.last_name || ''}`).toLowerCase();
    const email = (c.email || '').toLowerCase();
    const phone = (c.normalized_phone || c.phone || '').toLowerCase();
    const company = (c.company_name || '').toLowerCase();
    return name.includes(term) || email.includes(term) || phone.includes(term) || company.includes(term);
  });
  
  renderAvailableContacts(filtered);
};

// Switch between existing and new contact tabs
window.switchAddContactTab = function(tab) {
  const existingTab = document.getElementById('add-contact-tab-existing');
  const newTab = document.getElementById('add-contact-tab-new');
  const existingContent = document.getElementById('add-contact-existing-tab');
  const newContent = document.getElementById('add-contact-new-tab');
  
  if (tab === 'existing') {
    existingTab?.classList.add('text-nfgblue', 'border-nfgblue');
    existingTab?.classList.remove('text-gray-500', 'dark:text-gray-400', 'border-transparent');
    newTab?.classList.remove('text-nfgblue', 'border-nfgblue');
    newTab?.classList.add('text-gray-500', 'dark:text-gray-400', 'border-transparent');
    existingContent?.classList.remove('hidden');
    newContent?.classList.add('hidden');
  } else {
    newTab?.classList.add('text-nfgblue', 'border-nfgblue');
    newTab?.classList.remove('text-gray-500', 'dark:text-gray-400', 'border-transparent');
    existingTab?.classList.remove('text-nfgblue', 'border-nfgblue');
    existingTab?.classList.add('text-gray-500', 'dark:text-gray-400', 'border-transparent');
    newContent?.classList.remove('hidden');
    existingContent?.classList.add('hidden');
  }
};

// Link an existing contact to the current account
window.linkExistingContact = async function(contactId) {
  if (!currentAccount) {
    toast.error('No account selected', 'Error');
    return;
  }
  
  try {
    // Update the contact to link it to this account
    const { error } = await supabase
      .from('contacts')
      .update({ account_id: currentAccount.id })
      .eq('id', contactId);
    
    if (error) throw error;
    
    toast.success('Contact linked to account');
    document.getElementById('add-contact-modal')?.classList.add('hidden');
    
    // Refresh the drawer and accounts list
    await loadAccounts();
    await openAccountDrawer(currentAccount.id);
  } catch (error) {
    console.error('[Accounts] Error linking contact:', error);
    toast.error('Failed to link contact: ' + (error.message || 'Unknown error'), 'Error');
  }
};

window.openEditAccountModal = function() {
  if (!currentAccount) {
    toast.error('No account selected', 'Error');
    return;
  }
  const modal = document.getElementById('edit-account-modal');
  if (modal) {
    // Populate form with current account data
    document.getElementById('edit-account-id').value = currentAccount.id || '';
    document.getElementById('edit-account-name').value = currentAccount.name || '';
    document.getElementById('edit-account-status').value = currentAccount.status || 'prospect';
    document.getElementById('edit-account-industry').value = currentAccount.industry || '';
    document.getElementById('edit-account-phone').value = currentAccount.phone || '';
    document.getElementById('edit-account-email').value = currentAccount.email || '';
    document.getElementById('edit-account-website').value = currentAccount.website || '';
    document.getElementById('edit-account-hq-address').value = currentAccount.hq_address || '';
    document.getElementById('edit-account-city').value = currentAccount.city || '';
    document.getElementById('edit-account-notes').value = currentAccount.notes || '';
    
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }
};

window.openSetDMModal = function() {
  if (!currentAccount) {
    toast.error('No account selected', 'Error');
    return;
  }
  openSetDMModal(currentAccount);
};

// Export for use in sales.html
const accountsDirectoryModule = {
  init: initAccountsDirectory,
  loadAccounts,
  openAccountDrawer,
  closeAccountDrawer,
  openContactDetailModal,
  closeContactDetailModal,
  handleAccountAction,
  handleContactAction
};

// Set on window for backward compatibility
window.accountsDirectory = accountsDirectoryModule;

// Also export as default and named exports
export default accountsDirectoryModule;
export { initAccountsDirectory, loadAccounts, openAccountDrawer, closeAccountDrawer };
