/**
 * Accounts Directory Module
 * Handles the Accounts Directory UI for Sales -> Contacts page
 */

import { supabase } from './supabase.js';
import { toast } from './notifications.js';
import * as accountsService from './accounts-service.js';

let currentUser = null;
let currentUserProfile = null;
let currentAccount = null;
let accounts = [];
let allReps = [];

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

// Load accounts
async function loadAccounts() {
  const tbody = document.getElementById('accounts-table-body');
  if (!tbody) {
    console.warn('[Accounts] Table body not found');
    return;
  }

  try {
    console.log('[Accounts] Loading accounts...');
    const search = document.getElementById('accounts-search')?.value || '';
    const statusFilter = document.getElementById('accounts-status-filter')?.value || '';
    const ownerFilter = document.getElementById('accounts-owner-filter')?.value || '';
    const sitesFilter = document.getElementById('accounts-sites-filter')?.value || '';
    const sortBy = document.getElementById('accounts-sort')?.value || 'last_touch_at_desc';

    const filters = {};
    if (statusFilter) filters.status = [statusFilter];
    if (ownerFilter) filters.owner_user_id = ownerFilter;
    if (sitesFilter) filters.sites = sitesFilter;

    accounts = await accountsService.listAccounts({
      search,
      filters,
      sort: sortBy
    });

    console.log('[Accounts] Accounts loaded:', accounts?.length || 0);
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
  }
}

// Render accounts table
function renderAccounts() {
  const tbody = document.getElementById('accounts-table-body');
  if (!tbody) return;

  if (!accounts || accounts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="px-4 py-12 text-center">
          <i data-lucide="building" class="w-16 h-16 mx-auto text-gray-300 mb-4"></i>
          <p class="text-gray-500">No accounts found</p>
          <button id="create-account-btn-empty" class="mt-4 px-4 py-2 bg-nfgblue hover:bg-nfgdark text-white rounded-xl font-medium transition inline-flex items-center gap-2">
            <i data-lucide="plus" class="w-4 h-4"></i> Create Account
          </button>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = accounts.map(account => {
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
      <tr class="account-row hover:bg-nfglight cursor-pointer border-b border-nfgray" data-account-id="${account.id}">
        <td class="px-4 py-3">
          <div class="font-medium text-nfgblue dark:text-blue-400">${escapeHtml(account.name)}</div>
          ${account.city ? `<div class="text-sm text-gray-500">${escapeHtml(account.city)}</div>` : ''}
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
            <button class="account-actions-btn p-1 rounded hover:bg-nfgray" onclick="event.stopPropagation()">
              <i data-lucide="more-vertical" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
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
    if (!drawer) return;

    currentAccount = await accountsService.getAccountDetail(accountId);
    renderAccountDrawer();
    drawer.classList.remove('hidden');
  } catch (error) {
    console.error('[Accounts] Error opening account drawer:', error);
    toast.error('Failed to load account details', 'Error');
  }
}

// Close account drawer
function closeAccountDrawer() {
  const drawer = document.getElementById('account-drawer');
  if (drawer) drawer.classList.add('hidden');
  currentAccount = null;
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
        <button id="drawer-add-site-btn" class="px-3 py-2 text-sm bg-nfgblue hover:bg-nfgdark text-white rounded-lg">Add Site</button>
        <button id="drawer-add-contact-btn" class="px-3 py-2 text-sm border border-nfgray hover:bg-nfglight rounded-lg">Add Contact</button>
        <button id="drawer-edit-account-btn" class="px-3 py-2 text-sm border border-nfgray hover:bg-nfglight rounded-lg">Edit</button>
      </div>
    `;
  }

  // Decision Maker
  const dmSection = document.getElementById('drawer-decision-maker');
  if (dmSection) {
    if (currentAccount.dm_contact) {
      const dm = currentAccount.dm_contact;
      dmSection.innerHTML = `
        <div class="p-4 border border-nfgray rounded-xl">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <h4 class="font-medium text-nfgblue dark:text-blue-400">${escapeHtml(dm.full_name)}</h4>
              ${dm.title ? `<p class="text-sm text-gray-600 mt-1">${escapeHtml(dm.title)}</p>` : ''}
              <div class="mt-2 flex items-center gap-3">
                ${dm.phone ? `<a href="tel:${dm.phone}" class="text-sm text-gray-600 hover:text-nfgblue flex items-center gap-1"><i data-lucide="phone" class="w-4 h-4"></i> ${escapeHtml(dm.phone)}</a>` : ''}
                ${dm.email ? `<a href="mailto:${dm.email}" class="text-sm text-gray-600 hover:text-nfgblue flex items-center gap-1"><i data-lucide="mail" class="w-4 h-4"></i> ${escapeHtml(dm.email)}</a>` : ''}
              </div>
            </div>
            <button id="drawer-change-dm-btn" class="px-3 py-1 text-sm border border-nfgray hover:bg-nfglight rounded-lg">Change DM</button>
          </div>
        </div>
      `;
    } else {
      dmSection.innerHTML = `
        <div class="p-4 border border-nfgray rounded-xl text-center">
          <p class="text-sm text-gray-500 mb-3">No decision maker set</p>
          <button id="drawer-set-dm-btn" class="px-4 py-2 bg-nfgblue hover:bg-nfgdark text-white rounded-lg">Set Decision Maker</button>
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
export async function initAccountsDirectory() {
  try {
    console.log('[Accounts] Initializing accounts directory...');
    
    // Check if table body exists
    const tbody = document.getElementById('accounts-table-body');
    if (!tbody) {
      console.warn('[Accounts] Table body not found, waiting for DOM...');
      // Wait a bit and try again
      await new Promise(resolve => setTimeout(resolve, 100));
      const retryTbody = document.getElementById('accounts-table-body');
      if (!retryTbody) {
        console.error('[Accounts] Table body still not found after retry');
        return;
      }
    }
    
    await getCurrentUser();
    
    // Load reps if manager/admin
    if (currentUserProfile && ['admin', 'manager', 'client'].includes(currentUserProfile.role)) {
      await loadReps();
    }

    // Setup event listeners (idempotent - safe to call multiple times)
    setupEventListeners();
    
    // Load accounts
    await loadAccounts();
    
    console.log('[Accounts] Accounts directory initialized successfully');
  } catch (error) {
    console.error('[Accounts] Error initializing accounts directory:', error);
    toast.error('Failed to initialize accounts directory', 'Error');
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
  document.getElementById('create-account-close')?.addEventListener('click', () => {
    document.getElementById('create-account-modal')?.classList.add('hidden');
  });
  document.getElementById('create-account-cancel')?.addEventListener('click', () => {
    document.getElementById('create-account-modal')?.classList.add('hidden');
  });

  // Account row click
  document.getElementById('accounts-table-body')?.addEventListener('click', (e) => {
    const row = e.target.closest('.account-row');
    if (row && !e.target.closest('button, a')) {
      openAccountDrawer(row.dataset.accountId);
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
  document.getElementById('create-account-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await accountsService.createAccount({
        name: formData.get('name'),
        status: formData.get('status'),
        hq_address: formData.get('hq_address'),
        city: formData.get('city')
      });
      toast.success('Account created');
      document.getElementById('create-account-modal')?.classList.add('hidden');
      e.target.reset();
      await loadAccounts();
    } catch (error) {
      toast.error('Failed to create account', 'Error');
    }
  });

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
}

// Open set DM modal
function openSetDMModal(account) {
  const modal = document.getElementById('set-dm-modal');
  if (!modal) return;
  
  const contactsList = document.getElementById('set-dm-contacts-list');
  if (contactsList) {
    if (!account.contacts || account.contacts.length === 0) {
      contactsList.innerHTML = '<p class="text-sm text-gray-500">No contacts available. Add a contact first.</p>';
    } else {
      contactsList.innerHTML = account.contacts.map(contact => `
        <button class="set-dm-contact-btn w-full text-left p-3 border border-nfgray rounded-lg hover:bg-nfglight" data-contact-id="${contact.id}">
          <div class="font-medium">${escapeHtml(contact.full_name)}</div>
          ${contact.title ? `<div class="text-sm text-gray-600">${escapeHtml(contact.title)}</div>` : ''}
        </button>
      `).join('');
    }
  }

  modal.dataset.accountId = account.id;
  modal.classList.remove('hidden');

  // Setup contact selection
  contactsList?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.set-dm-contact-btn');
    if (btn) {
      const contactId = btn.dataset.contactId;
      try {
        await accountsService.setDecisionMaker(account.id, contactId);
        toast.success('Decision maker set');
        modal.classList.add('hidden');
        await loadAccounts();
        if (currentAccount && currentAccount.id === account.id) {
          await openAccountDrawer(account.id);
        }
      } catch (error) {
        toast.error('Failed to set decision maker', 'Error');
      }
    }
  });
}

// Export for use in sales.html
window.accountsDirectory = {
  init: initAccountsDirectory,
  loadAccounts,
  openAccountDrawer,
  closeAccountDrawer
};
