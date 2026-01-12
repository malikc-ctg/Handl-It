/**
 * Leads Directory Module
 * Handles the Leads UI for Sales -> Leads page (Quo-style calling list)
 */

import { supabase } from './supabase.js';
import { toast } from './notifications.js';
import * as leadsService from './leads-service.js';

let currentUser = null;
let currentUserProfile = null;
let currentLead = null;
let leads = [];
let allReps = [];

// Disposition outcomes
const DISPOSITIONS = [
  { value: 'no_answer', label: 'No Answer', nextAction: '+4h' },
  { value: 'gatekeeper', label: 'Gatekeeper', nextAction: 'tomorrow 10am' },
  { value: 'dm_reached', label: 'DM Reached', nextAction: '+24h' },
  { value: 'callback_set', label: 'Callback Set', nextAction: 'custom' },
  { value: 'booked_walkthrough', label: 'Booked Walkthrough', nextAction: 'custom' },
  { value: 'not_interested', label: 'Not Interested', nextAction: null },
  { value: 'wrong_number', label: 'Wrong Number', nextAction: null },
  { value: 'do_not_contact', label: 'Do Not Contact', nextAction: null }
];

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
    console.error('[Leads] Error getting current user:', error);
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
    console.error('[Leads] Error loading reps:', error);
  }
}

// Load leads
async function loadLeads() {
  try {
    const search = document.getElementById('leads-search')?.value || '';
    const statusFilter = document.getElementById('leads-status-filter')?.value || '';
    const sourceFilter = document.getElementById('leads-source-filter')?.value || '';
    const ownerFilter = document.getElementById('leads-owner-filter')?.value || '';
    const priorityFilter = document.getElementById('leads-priority-filter')?.value || '';
    const hasPhoneFilter = document.getElementById('leads-has-phone-filter')?.value || '';
    const sortBy = document.getElementById('leads-sort')?.value || 'next_action_at_asc';

    const filters = {};
    if (statusFilter) filters.status = [statusFilter];
    if (sourceFilter) filters.source = [sourceFilter];
    if (ownerFilter) filters.owner_user_id = ownerFilter;
    if (priorityFilter) filters.priority = parseInt(priorityFilter);
    if (hasPhoneFilter) filters.has_phone = hasPhoneFilter;

    leads = await leadsService.listLeads({
      search,
      filters,
      sort: sortBy
    });

    renderLeads();
  } catch (error) {
    console.error('[Leads] Error loading leads:', error);
    toast.error('Failed to load leads', 'Error');
  }
}

// Render leads list (Quo-style calling list)
function renderLeads() {
  const container = document.getElementById('leads-list');
  if (!container) return;

  if (!leads || leads.length === 0) {
    container.innerHTML = `
      <div class="bg-white dark:bg-gray-800 border border-nfgray rounded-xl p-12 text-center">
        <i data-lucide="user-plus" class="w-16 h-16 mx-auto text-gray-300 mb-4"></i>
        <p class="text-gray-500 dark:text-gray-400 mb-4">No leads found</p>
        <button id="create-lead-btn-empty" class="px-4 py-2 bg-nfgblue hover:bg-nfgdark text-white rounded-xl font-medium transition inline-flex items-center gap-2">
          <i data-lucide="plus" class="w-4 h-4"></i> Create Lead
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = leads.map(lead => {
    const primaryName = lead.company_name || lead.person_name || 'Unnamed Lead';
    const subline = [lead.city, lead.source].filter(Boolean).join(' • ');
    const statusBadges = {
      new: '<span class="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">New</span>',
      contacted: '<span class="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">Contacted</span>',
      dm_reached: '<span class="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">DM Reached</span>',
      walkthrough_booked: '<span class="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Walkthrough Booked</span>',
      quote_pending: '<span class="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Quote Pending</span>',
      unqualified: '<span class="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Unqualified</span>',
      do_not_contact: '<span class="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">Do Not Contact</span>'
    };
    
    const statusBadge = statusBadges[lead.status] || statusBadges.new;
    const lastTouch = lead.last_touch_at ? formatCompactDate(lead.last_touch_at) : '—';
    const nextAction = lead.next_action_at ? formatCompactDate(lead.next_action_at) : '—';
    const attemptsCount = lead.attempts_count || 0;

    return `
      <div class="lead-row bg-white dark:bg-gray-800 border border-nfgray dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition cursor-pointer" data-lead-id="${lead.id}">
        <div class="flex items-start justify-between gap-4">
          <!-- Left: Company/Person Name + Subline -->
          <div class="flex-1 min-w-0">
            <div class="font-medium text-nfgblue dark:text-blue-400 truncate">${escapeHtml(primaryName)}</div>
            <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">${escapeHtml(subline)}</div>
            ${lead.person_name && lead.company_name ? `<div class="text-sm text-gray-600 dark:text-gray-300 mt-1">${escapeHtml(lead.person_name)}${lead.title ? ` - ${escapeHtml(lead.title)}` : ''}</div>` : ''}
          </div>
          
          <!-- Middle: Contact Info -->
          <div class="flex items-center gap-3">
            ${lead.phone ? `<a href="tel:${lead.phone}" class="text-gray-600 dark:text-gray-400 hover:text-nfgblue dark:hover:text-blue-400" onclick="event.stopPropagation()"><i data-lucide="phone" class="w-5 h-5"></i></a>` : '<span class="text-gray-300 dark:text-gray-600"><i data-lucide="phone" class="w-5 h-5"></i></span>'}
            ${lead.email ? `<a href="mailto:${lead.email}" class="text-gray-600 dark:text-gray-400 hover:text-nfgblue dark:hover:text-blue-400" onclick="event.stopPropagation()"><i data-lucide="mail" class="w-5 h-5"></i></a>` : '<span class="text-gray-300 dark:text-gray-600"><i data-lucide="mail" class="w-5 h-5"></i></span>'}
          </div>
          
          <!-- Right: Status, Metrics, Actions -->
          <div class="flex items-center gap-4 flex-shrink-0">
            <div class="text-right text-sm">
              <div class="mb-1">${statusBadge}</div>
              <div class="text-gray-500 dark:text-gray-400">${attemptsCount} attempts</div>
              <div class="text-gray-500 dark:text-gray-400">Last: ${lastTouch}</div>
              <div class="text-gray-500 dark:text-gray-400">Next: ${nextAction}</div>
            </div>
            
            <!-- Quick Actions -->
            <div class="flex items-center gap-2">
              ${lead.phone ? `<button class="call-lead-btn px-3 py-1.5 bg-nfgblue hover:bg-nfgdark text-white rounded-lg text-sm font-medium transition" data-lead-id="${lead.id}" data-phone="${lead.phone}" onclick="event.stopPropagation()">
                <i data-lucide="phone" class="w-4 h-4 inline mr-1"></i> Call
              </button>` : ''}
              <div class="relative">
                <button class="disposition-btn px-3 py-1.5 border border-nfgray dark:border-gray-600 hover:bg-nfglight dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition" data-lead-id="${lead.id}" onclick="event.stopPropagation()">
                  <i data-lucide="more-vertical" class="w-4 h-4"></i>
                </button>
              </div>
              <button class="open-lead-btn px-3 py-1.5 border border-nfgray dark:border-gray-600 hover:bg-nfglight dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition" data-lead-id="${lead.id}" onclick="event.stopPropagation()">
                Open
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Format compact date
function formatCompactDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date - now;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Tomorrow';
  } else if (diffDays === -1) {
    return 'Yesterday';
  } else if (diffDays > 0 && diffDays < 7) {
    return `In ${diffDays}d`;
  } else if (diffDays < 0 && diffDays > -7) {
    return `${Math.abs(diffDays)}d ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Open lead drawer
async function openLeadDrawer(leadId) {
  try {
    const drawer = document.getElementById('lead-drawer');
    if (!drawer) {
      console.warn('[Leads] Lead drawer not found');
      return;
    }

    currentLead = await leadsService.getLeadDetail(leadId);
    renderLeadDrawer();
    drawer.classList.remove('hidden');
  } catch (error) {
    console.error('[Leads] Error opening lead drawer:', error);
    toast.error('Failed to load lead details', 'Error');
  }
}

// Close lead drawer
function closeLeadDrawer() {
  const drawer = document.getElementById('lead-drawer');
  if (drawer) drawer.classList.add('hidden');
  currentLead = null;
}

// Render lead drawer content
function renderLeadDrawer() {
  if (!currentLead) return;

  // Lead Summary
  const summarySection = document.getElementById('drawer-lead-summary');
  if (summarySection) {
    const statusBadges = {
      new: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">New</span>',
      contacted: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Contacted</span>',
      dm_reached: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">DM Reached</span>',
      walkthrough_booked: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">Walkthrough Booked</span>',
      quote_pending: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Quote Pending</span>',
      unqualified: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Unqualified</span>',
      do_not_contact: '<span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Do Not Contact</span>'
    };
    
    summarySection.innerHTML = `
      <div>
        <h3 class="text-lg font-semibold text-nfgblue dark:text-blue-400">${escapeHtml(currentLead.company_name || currentLead.person_name || 'Unnamed Lead')}</h3>
        ${currentLead.person_name && currentLead.company_name ? `<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${escapeHtml(currentLead.person_name)}${currentLead.title ? ` - ${escapeHtml(currentLead.title)}` : ''}</p>` : ''}
        <div class="mt-2 flex items-center gap-2">
          ${statusBadges[currentLead.status] || statusBadges.new}
          <span class="text-sm text-gray-500">•</span>
          <span class="text-sm text-gray-600 dark:text-gray-400">${escapeHtml(currentLead.owner?.full_name || 'Unassigned')}</span>
          ${currentLead.priority ? `<span class="text-sm text-gray-500">• Priority: ${currentLead.priority}</span>` : ''}
        </div>
        ${currentLead.address ? `<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">${escapeHtml(currentLead.address)}${currentLead.city ? `, ${escapeHtml(currentLead.city)}` : ''}</p>` : ''}
        <div class="mt-3 flex items-center gap-4">
          ${currentLead.phone ? `<a href="tel:${currentLead.phone}" class="text-sm text-gray-600 dark:text-gray-400 hover:text-nfgblue dark:hover:text-blue-400 flex items-center gap-1"><i data-lucide="phone" class="w-4 h-4"></i> ${escapeHtml(currentLead.phone)}</a>` : ''}
          ${currentLead.email ? `<a href="mailto:${currentLead.email}" class="text-sm text-gray-600 dark:text-gray-400 hover:text-nfgblue dark:hover:text-blue-400 flex items-center gap-1"><i data-lucide="mail" class="w-4 h-4"></i> ${escapeHtml(currentLead.email)}</a>` : ''}
        </div>
        ${currentLead.source ? `<p class="mt-2 text-sm text-gray-500">Source: ${escapeHtml(currentLead.source)}</p>` : ''}
      </div>
      <div class="flex gap-2 mt-4">
        ${currentLead.phone ? `<button id="drawer-call-btn" class="px-3 py-2 text-sm bg-nfgblue hover:bg-nfgdark text-white rounded-lg">Call</button>` : ''}
        ${currentLead.email ? `<button id="drawer-email-btn" class="px-3 py-2 text-sm border border-nfgray hover:bg-nfglight rounded-lg">Email</button>` : ''}
        ${currentLead.phone ? `<button id="drawer-sms-btn" class="px-3 py-2 text-sm border border-nfgray hover:bg-nfglight rounded-lg">SMS</button>` : ''}
        <button id="drawer-set-next-action-btn" class="px-3 py-2 text-sm border border-nfgray hover:bg-nfglight rounded-lg">Set Next Action</button>
        ${!currentLead.account_id ? `<button id="drawer-convert-btn" class="px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg">Convert to Account</button>` : ''}
      </div>
    `;
  }

  // Activities
  const activitiesSection = document.getElementById('drawer-activities');
  if (activitiesSection) {
    if (!currentLead.activities || currentLead.activities.length === 0) {
      activitiesSection.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">No activities yet</p>';
    } else {
      activitiesSection.innerHTML = currentLead.activities.map(activity => {
        const outcomeLabels = {
          no_answer: 'No Answer',
          gatekeeper: 'Gatekeeper',
          dm_reached: 'DM Reached',
          callback_set: 'Callback Set',
          booked_walkthrough: 'Booked Walkthrough',
          not_interested: 'Not Interested',
          wrong_number: 'Wrong Number',
          do_not_contact: 'Do Not Contact'
        };
        
        return `
          <div class="p-3 border border-nfgray dark:border-gray-700 rounded-lg">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-medium">${activity.type === 'call' ? 'Call' : activity.type}</div>
                ${activity.outcome ? `<div class="text-xs text-gray-500 dark:text-gray-400">${outcomeLabels[activity.outcome] || activity.outcome}</div>` : ''}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">${formatCompactDate(activity.timestamp)}</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Conversion status
  const conversionSection = document.getElementById('drawer-conversion');
  if (conversionSection) {
    if (currentLead.account_id) {
      conversionSection.innerHTML = `
        <div class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div class="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Converted</div>
          ${currentLead.account ? `<div class="text-sm text-green-700 dark:text-green-300">Account: ${escapeHtml(currentLead.account.name)}</div>` : ''}
          ${currentLead.contact ? `<div class="text-sm text-green-700 dark:text-green-300">Contact: ${escapeHtml(currentLead.contact.full_name)}</div>` : ''}
          ${currentLead.deal ? `<div class="text-sm text-green-700 dark:text-green-300">Deal: ${escapeHtml(currentLead.deal.name || currentLead.deal.id)}</div>` : ''}
        </div>
      `;
    } else {
      conversionSection.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Not converted</p>';
    }
  }

  if (window.lucide) lucide.createIcons();
}

// Initialize leads directory
export async function initLeadsDirectory() {
  await getCurrentUser();
  
  // Load reps if manager/admin
  if (currentUserProfile && ['admin', 'manager', 'client'].includes(currentUserProfile.role)) {
    await loadReps();
  }

  // Setup event listeners
  setupEventListeners();
  
  // Load leads
  await loadLeads();
}

// Setup event listeners
function setupEventListeners() {
  // Search
  const searchInput = document.getElementById('leads-search');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => loadLeads(), 300);
    });
  }

  // Filters
  document.querySelectorAll('#leads-status-filter, #leads-source-filter, #leads-owner-filter, #leads-priority-filter, #leads-has-phone-filter, #leads-sort').forEach(el => {
    el?.addEventListener('change', loadLeads);
  });

  // Create lead button
  document.querySelectorAll('#create-lead-btn, #create-lead-btn-empty').forEach(btn => {
    btn?.addEventListener('click', () => {
      document.getElementById('create-lead-modal')?.classList.remove('hidden');
    });
  });

  // Lead row click
  const leadsList = document.getElementById('leads-list');
  if (leadsList) {
    leadsList.addEventListener('click', (e) => {
      const row = e.target.closest('.lead-row');
      if (row && !e.target.closest('button, a')) {
        openLeadDrawer(row.dataset.leadId);
      }
    });
  }

  // Call button
  document.addEventListener('click', async (e) => {
    if (e.target.closest('.call-lead-btn')) {
      const btn = e.target.closest('.call-lead-btn');
      const leadId = btn.dataset.leadId;
      const phone = btn.dataset.phone;
      if (phone) {
        window.location.href = `tel:${phone}`;
        // Log call attempt (will be updated with disposition)
      }
    }

    // Disposition button
    if (e.target.closest('.disposition-btn')) {
      const btn = e.target.closest('.disposition-btn');
      const leadId = btn.dataset.leadId;
      openDispositionModal(leadId);
    }

    // Open lead button
    if (e.target.closest('.open-lead-btn')) {
      const btn = e.target.closest('.open-lead-btn');
      const leadId = btn.dataset.leadId;
      openLeadDrawer(leadId);
    }
  });

  // Close drawer
  document.getElementById('lead-drawer-close')?.addEventListener('click', closeLeadDrawer);

  // Drawer actions
  document.addEventListener('click', async (e) => {
    if (e.target.closest('#drawer-call-btn')) {
      if (currentLead && currentLead.phone) {
        window.location.href = `tel:${currentLead.phone}`;
      }
    }
    
    if (e.target.closest('#drawer-email-btn')) {
      if (currentLead && currentLead.email) {
        window.location.href = `mailto:${currentLead.email}`;
      }
    }
    
    if (e.target.closest('#drawer-convert-btn')) {
      if (currentLead) {
        openConvertModal(currentLead);
      }
    }
  });
}

// Open disposition modal
function openDispositionModal(leadId) {
  const modal = document.getElementById('disposition-modal');
  if (!modal) {
    console.warn('[Leads] Disposition modal not found');
    return;
  }
  
  modal.dataset.leadId = leadId;
  modal.classList.remove('hidden');
  
  // Setup disposition buttons
  const dispositionsList = document.getElementById('dispositions-list');
  if (dispositionsList) {
    dispositionsList.innerHTML = DISPOSITIONS.map(disp => `
      <button class="disposition-option-btn w-full text-left p-3 border border-nfgray rounded-lg hover:bg-nfglight dark:hover:bg-gray-700 transition" data-outcome="${disp.value}">
        <div class="font-medium">${disp.label}</div>
        ${disp.nextAction ? `<div class="text-xs text-gray-500 dark:text-gray-400">Next action: ${disp.nextAction}</div>` : ''}
      </button>
    `).join('');
    
    dispositionsList.addEventListener('click', async (e) => {
      const btn = e.target.closest('.disposition-option-btn');
      if (btn) {
        const outcome = btn.dataset.outcome;
        try {
          await leadsService.updateLeadStatusAndDisposition(leadId, outcome);
          toast.success('Disposition updated');
          modal.classList.add('hidden');
          await loadLeads();
          if (currentLead && currentLead.id === leadId) {
            await openLeadDrawer(leadId);
          }
        } catch (error) {
          toast.error('Failed to update disposition', 'Error');
        }
      }
    });
  }
  
  if (window.lucide) lucide.createIcons();
}

// Open convert modal
function openConvertModal(lead) {
  const modal = document.getElementById('convert-lead-modal');
  if (!modal) {
    console.warn('[Leads] Convert modal not found');
    return;
  }
  
  modal.dataset.leadId = lead.id;
  modal.classList.remove('hidden');
  
  // Populate form with lead data
  const accountNameInput = document.getElementById('convert-account-name');
  if (accountNameInput) accountNameInput.value = lead.company_name || '';
  
  // Setup form submission
  const form = document.getElementById('convert-lead-form');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      try {
        const result = await leadsService.convertLead(lead.id, {
          create_account: true,
          create_contact: true,
          create_deal: formData.get('create_deal') === 'on' || lead.status === 'dm_reached' || lead.status === 'walkthrough_booked'
        });
        toast.success('Lead converted successfully');
        modal.classList.add('hidden');
        await loadLeads();
        if (currentLead && currentLead.id === lead.id) {
          await openLeadDrawer(lead.id);
        }
      } catch (error) {
        toast.error('Failed to convert lead', 'Error');
      }
    };
  }
}

// Export for use in sales.html
window.leadsDirectory = {
  init: initLeadsDirectory,
  loadLeads,
  openLeadDrawer,
  closeLeadDrawer
};
