// Sales Portal JavaScript Module
// Handles deals, quotes, timeline, follow-up sequences, and Quo integration

import { supabase } from './supabase.js';
import { toast } from './notifications.js';

// ==========================================
// STATE MANAGEMENT
// ==========================================
let currentUser = null;
let currentUserProfile = null;
let deals = [];
let sites = [];
let currentDeal = null;
let quoteLineItems = { good: [], better: [], best: [] };

// ==========================================
// QUO INTEGRATION (Agent 04)
// ==========================================
const QuoAPI = {
  // Launch Quo call - placeholder for Agent 04 integration
  async launchCall(phoneNumber, dealId) {
    try {
      // TODO: Replace with actual Quo API call via Agent 04
      // This should call the backend endpoint created by Agent 05
      const response = await fetch('/api/quo/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, dealId })
      });
      
      if (!response.ok) throw new Error('Failed to launch call');
      
      const data = await response.json();
      
      // Create timeline event for call initiation
      await createTimelineEvent(dealId, 'call', 'Call Initiated', `Calling ${phoneNumber}`, {
        quoCallId: data.callId,
        phoneNumber
      });
      
      toast.success('Call launched successfully', 'Call Started');
      return data;
    } catch (error) {
      console.error('Quo call error:', error);
      toast.error('Failed to launch call', 'Error');
      throw error;
    }
  },

  // Send text message - placeholder for Agent 04 integration
  async sendText(phoneNumber, message, dealId) {
    try {
      // TODO: Replace with actual Quo API call via Agent 04
      const response = await fetch('/api/quo/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, message, dealId })
      });
      
      if (!response.ok) throw new Error('Failed to send text');
      
      await createTimelineEvent(dealId, 'message', 'Text Sent', message, { phoneNumber });
      toast.success('Text sent successfully', 'Message Sent');
    } catch (error) {
      console.error('Quo text error:', error);
      toast.error('Failed to send text', 'Error');
      throw error;
    }
  },

  // Send email - placeholder
  async sendEmail(email, subject, body, dealId) {
    try {
      // TODO: Replace with actual email API call
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, subject, body, dealId })
      });
      
      if (!response.ok) throw new Error('Failed to send email');
      
      await createTimelineEvent(dealId, 'email', 'Email Sent', subject, { email });
      toast.success('Email sent successfully', 'Email Sent');
    } catch (error) {
      console.error('Email error:', error);
      toast.error('Failed to send email', 'Error');
      throw error;
    }
  }
};

// ==========================================
// ERROR BOUNDARY
// ==========================================
function showErrorBoundary(message, error) {
  console.error('[Sales] Error:', message, error);
  const main = document.querySelector('main');
  if (main) {
    main.innerHTML = `
      <div class="flex items-center justify-center h-full p-6">
        <div class="bg-white dark:bg-gray-800 border border-red-300 dark:border-red-700 rounded-xl p-8 max-w-md text-center">
          <i data-lucide="alert-circle" class="w-16 h-16 mx-auto text-red-500 mb-4"></i>
          <h3 class="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">Something went wrong</h3>
          <p class="text-gray-600 dark:text-gray-400 mb-4">${message}</p>
          <button onclick="window.location.reload()" class="px-4 py-2 bg-nfgblue hover:bg-nfgdark text-white rounded-lg font-medium transition">
            Reload Page
          </button>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }
}

// ==========================================
// LOADING STATES
// ==========================================
function showLoading(elementId, message = 'Loading...') {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = `
      <div class="flex items-center justify-center py-8">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-nfgblue dark:border-blue-400 mb-2"></div>
          <p class="text-sm text-gray-500 dark:text-gray-400">${message}</p>
        </div>
      </div>
    `;
  }
}

// ==========================================
// INITIALIZATION
// ==========================================
export async function init() {
  console.log('[Sales] 🚀 Initializing sales portal...');
  
  try {
    // Show loading state
    showLoading('deals-list', 'Loading deals...');

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = './index.html';
      return;
    }
    currentUser = user;

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('[Sales] Profile error:', profileError);
      // Continue with limited access if profile fetch fails
    }
    currentUserProfile = profile;

    // Check role-based access
    if (profile && !hasSalesAccess(profile)) {
      console.warn('[Sales] User does not have sales access, but allowing view with limited functionality');
      // Don't redirect - allow view but show warning
      // User can still see the dashboard but some features may be restricted
      toast.warning('Limited access mode - some features may be restricted', 'Notice');
    }

    // Load initial data
    await Promise.all([
      loadSites(),
      loadDeals()
    ]);
    
    await setupEventListeners();
    await checkRoleBasedUI();

    console.log('[Sales] ✅ Initialization complete');
  } catch (error) {
    console.error('[Sales] ❌ Initialization error:', error);
    showErrorBoundary('Failed to initialize sales portal. Please try refreshing the page.', error);
  }
}

// ==========================================
// ROLE-BASED ACCESS
// ==========================================
function hasSalesAccess(profile) {
  if (!profile) return false;
  const role = profile.role;
  // Allow admin, manager, worker, and rep roles to access sales portal
  return ['admin', 'manager', 'super_admin', 'worker', 'rep'].includes(role);
}

async function checkRoleBasedUI() {
  if (!currentUserProfile) return;
  
  const role = currentUserProfile.role;
  const isManager = ['manager', 'admin', 'super_admin'].includes(role);
  
  // Show performance widgets for managers/admins
  const performanceWidgets = document.getElementById('performance-widgets');
  if (performanceWidgets) {
    if (isManager) {
      performanceWidgets.classList.remove('hidden');
      await loadPerformanceMetrics();
    } else {
      performanceWidgets.classList.add('hidden');
    }
  }
}

// ==========================================
// LOAD DATA
// ==========================================
async function loadSites() {
  try {
    const { data, error } = await supabase
      .from('sites')
      .select('id, name, address')
      .order('name', { ascending: true });
    
    if (error) throw error;
    sites = data || [];
    
    // Populate site select in create deal modal
    const siteSelect = document.getElementById('deal-site-select');
    if (siteSelect) {
      siteSelect.innerHTML = '<option value="">Select a site...</option>' +
        sites.map(site => `<option value="${site.id}">${site.name}</option>`).join('');
    }
  } catch (error) {
    console.error('[Sales] Error loading sites:', error);
    toast.error('Failed to load sites', 'Error');
  }
}

async function loadDeals() {
  try {
    showLoading('deals-list', 'Loading deals...');
    
    let query = supabase
      .from('deals')
      .select(`
        *,
        sites:site_id (id, name, address),
        assigned_user:assigned_to (id, email)
      `)
      .order('created_at', { ascending: false });

    // Filter by assigned user if rep
    if (currentUserProfile && currentUserProfile.role === 'rep') {
      query = query.eq('assigned_to', currentUser.id);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    deals = data || [];
    
    renderDealQueue();
  } catch (error) {
    console.error('[Sales] Error loading deals:', error);
    const dealsList = document.getElementById('deals-list');
    if (dealsList) {
      dealsList.innerHTML = `
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <i data-lucide="alert-circle" class="w-8 h-8 mx-auto text-red-500 mb-2"></i>
          <p class="text-red-600 dark:text-red-400 font-medium mb-1">Failed to load deals</p>
          <p class="text-sm text-red-500 dark:text-red-400 mb-4">${error.message || 'Unknown error'}</p>
          <button onclick="window.sales.loadDeals()" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition">
            Retry
          </button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
    }
    toast.error('Failed to load deals', 'Error');
  }
}

async function loadPerformanceMetrics() {
  try {
    // Load metrics for managers
    const { count: callsCount } = await supabase
      .from('call_logs')
      .select('*', { count: 'exact', head: true });
    
    const { count: quotesCount } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent');
    
    const { count: winsCount } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'won');
    
    document.getElementById('total-calls').textContent = callsCount || 0;
    document.getElementById('total-quotes').textContent = quotesCount || 0;
    document.getElementById('total-wins').textContent = winsCount || 0;
  } catch (error) {
    console.error('[Sales] Error loading performance metrics:', error);
  }
}

// ==========================================
// RENDER FUNCTIONS
// ==========================================
function renderDealQueue() {
  const dealsList = document.getElementById('deals-list');
  const emptyState = document.getElementById('empty-state');
  
  if (!dealsList) return;

  if (deals.length === 0) {
    dealsList.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  dealsList.classList.remove('hidden');
  if (emptyState) emptyState.classList.add('hidden');

  dealsList.innerHTML = deals.map(deal => {
    const site = deal.sites || {};
    const healthClass = getHealthClass(deal.health_score || 50);
    const priorityColors = {
      low: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
      medium: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
      high: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300',
      urgent: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
    };

    return `
      <div class="bg-white dark:bg-gray-800 border border-nfgray dark:border-gray-700 rounded-xl p-4 shadow-nfg hover:shadow-lg transition cursor-pointer" data-deal-id="${deal.id}">
        <div class="flex justify-between items-start mb-3">
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-nfgblue dark:text-blue-400 mb-1">${site.name || 'Unknown Site'}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">${site.address || ''}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-1 rounded-lg text-xs font-medium ${priorityColors[deal.priority] || priorityColors.medium}">
              ${deal.priority}
            </span>
            <span class="px-2 py-1 rounded-lg text-xs font-medium ${deal.status === 'active' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}">
              ${deal.status}
            </span>
          </div>
        </div>
        
        <div class="mb-3">
          <div class="flex justify-between items-center mb-1">
            <span class="text-xs text-gray-500 dark:text-gray-400">Health</span>
            <span class="text-xs font-semibold text-nfgblue dark:text-blue-400">${deal.health_score || 50}%</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div class="health-bar ${healthClass} h-2 rounded-full" style="width: ${deal.health_score || 50}%"></div>
          </div>
        </div>

        <div class="flex justify-between items-center text-sm">
          <span class="text-gray-500 dark:text-gray-400">
            ${deal.estimated_value ? `$${Number(deal.estimated_value).toLocaleString()}` : 'No value set'}
          </span>
          <button class="text-nfgblue dark:text-blue-400 hover:underline font-medium">
            View Deal →
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Attach click handlers
  dealsList.querySelectorAll('[data-deal-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      const dealId = card.dataset.dealId;
      openDealDetail(dealId);
    });
  });

  // Re-render icons
  if (window.lucide) lucide.createIcons();
}

function getHealthClass(score) {
  if (score >= 75) return 'health-excellent';
  if (score >= 50) return 'health-good';
  if (score >= 25) return 'health-fair';
  return 'health-poor';
}

async function renderDealDetail(deal) {
  if (!deal) return;

  const site = deal.sites || {};
  
  // Update header
  document.getElementById('deal-detail-name').textContent = site.name || 'Unknown Site';
  document.getElementById('deal-detail-site').textContent = site.address || '';
  document.getElementById('deal-detail-status').textContent = deal.status;
  document.getElementById('deal-detail-priority').textContent = deal.priority;
  
  // Update health
  const healthScore = deal.health_score || 50;
  document.getElementById('deal-health-score').textContent = `${healthScore}%`;
  const healthBar = document.getElementById('deal-health-bar');
  healthBar.className = `health-bar ${getHealthClass(healthScore)} h-2 rounded-full`;
  healthBar.style.width = `${healthScore}%`;

  // Load and render timeline
  await renderTimeline(deal.id);

  // Load and render quotes
  await renderQuotes(deal.id);

  // Load and render follow-up sequences
  await renderFollowUpSequences(deal.id);

  // Show detail view
  document.getElementById('deal-queue-view').classList.add('hidden');
  document.getElementById('deal-detail-view').classList.remove('hidden');
  document.getElementById('back-to-queue-btn').classList.remove('hidden');
}

async function renderTimeline(dealId) {
  try {
    const { data, error } = await supabase
      .from('timeline_events')
      .select('*, created_by_user:created_by (id, email)')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const timelineContainer = document.getElementById('timeline-container');
    if (!timelineContainer) return;

    if (!data || data.length === 0) {
      timelineContainer.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm">No timeline events yet.</p>';
      return;
    }

    const eventIcons = {
      call: 'phone',
      message: 'message-square',
      email: 'mail',
      quote: 'file-text',
      meeting: 'calendar',
      note: 'sticky-note',
      status_change: 'refresh-cw'
    };

    timelineContainer.innerHTML = data.map(event => {
      const icon = eventIcons[event.event_type] || 'circle';
      const user = event.created_by_user || {};
      const date = new Date(event.created_at).toLocaleString();

      return `
        <div class="timeline-item">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-nfglight dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
              <i data-lucide="${icon}" class="w-4 h-4 text-nfgblue dark:text-blue-400"></i>
            </div>
            <div class="flex-1">
              <div class="flex justify-between items-start mb-1">
                <h4 class="font-semibold text-nftext dark:text-gray-200">${event.title}</h4>
                <span class="text-xs text-gray-500 dark:text-gray-400">${date}</span>
              </div>
              ${event.description ? `<p class="text-sm text-gray-600 dark:text-gray-400 mb-1">${event.description}</p>` : ''}
              <p class="text-xs text-gray-500 dark:text-gray-400">by ${user.email || 'Unknown'}</p>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  } catch (error) {
    console.error('[Sales] Error rendering timeline:', error);
  }
}

async function renderQuotes(dealId) {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const quotesContainer = document.getElementById('quotes-container');
    if (!quotesContainer) return;

    if (!data || data.length === 0) {
      quotesContainer.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm">No quotes yet.</p>';
      return;
    }

    const statusColors = {
      draft: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
      sent: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
      viewed: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
      accepted: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
      rejected: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
      expired: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
    };

    quotesContainer.innerHTML = data.map(quote => {
      return `
        <div class="border border-nfgray dark:border-gray-700 rounded-lg p-4">
          <div class="flex justify-between items-start mb-2">
            <div>
              <h4 class="font-semibold text-nftext dark:text-gray-200">${quote.title}</h4>
              <p class="text-sm text-gray-500 dark:text-gray-400">${new Date(quote.created_at).toLocaleDateString()}</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-1 rounded-lg text-xs font-medium ${statusColors[quote.status] || statusColors.draft}">
                ${quote.status}
              </span>
              <span class="text-lg font-semibold text-nfgblue dark:text-blue-400">
                $${Number(quote.total_amount).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('[Sales] Error rendering quotes:', error);
  }
}

async function renderFollowUpSequences(dealId) {
  try {
    const { data, error } = await supabase
      .from('follow_up_sequences')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const sequencesContainer = document.getElementById('sequences-container');
    if (!sequencesContainer) return;

    if (!data || data.length === 0) {
      sequencesContainer.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm">No follow-up sequences assigned.</p>';
      return;
    }

    const statusColors = {
      active: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
      paused: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
      stopped: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
      completed: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
    };

    sequencesContainer.innerHTML = data.map(seq => {
      return `
        <div class="border border-nfgray dark:border-gray-700 rounded-lg p-4">
          <div class="flex justify-between items-start mb-2">
            <div>
              <h4 class="font-semibold text-nftext dark:text-gray-200">${seq.name}</h4>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Step ${seq.current_step} of ${seq.total_steps}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-1 rounded-lg text-xs font-medium ${statusColors[seq.status] || statusColors.active}">
                ${seq.status}
              </span>
              ${seq.status === 'active' ? `
                <button data-sequence-id="${seq.id}" data-action="pause-sequence" class="px-2 py-1 text-xs border border-nfgray dark:border-gray-700 hover:bg-nfglight dark:hover:bg-gray-700 rounded transition">
                  Pause
                </button>
                <button data-sequence-id="${seq.id}" data-action="stop-sequence" class="px-2 py-1 text-xs border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900 text-red-600 dark:text-red-400 rounded transition">
                  Stop
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach event listeners
    sequencesContainer.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const action = btn.dataset.action;
        const sequenceId = btn.dataset.sequenceId;
        if (action === 'pause-sequence') await pauseSequence(sequenceId);
        if (action === 'stop-sequence') await stopSequence(sequenceId);
      });
    });
  } catch (error) {
    console.error('[Sales] Error rendering follow-up sequences:', error);
  }
}

// ==========================================
// DEAL ACTIONS
// ==========================================
export async function openDealDetail(dealId) {
  try {
    const { data, error } = await supabase
      .from('deals')
      .select(`
        *,
        sites:site_id (id, name, address, contact_phone, contact_email)
      `)
      .eq('id', dealId)
      .single();

    if (error) throw error;
    
    currentDeal = data;
    await renderDealDetail(data);
  } catch (error) {
    console.error('[Sales] Error opening deal detail:', error);
    toast.error('Failed to load deal details', 'Error');
  }
}

export async function createDeal(formData) {
  try {
    const { data, error } = await supabase
      .from('deals')
      .insert({
        site_id: parseInt(formData.siteId),
        assigned_to: currentUser.id,
        priority: formData.priority,
        estimated_value: formData.value ? parseFloat(formData.value) : null,
        notes: formData.notes,
        created_by: currentUser.id
      })
      .select()
      .single();

    if (error) throw error;

    await loadDeals();
    toast.success('Deal created successfully', 'Success');
    closeCreateDealModal();
  } catch (error) {
    console.error('[Sales] Error creating deal:', error);
    toast.error('Failed to create deal', 'Error');
  }
}

// ==========================================
// QUOTE BUILDER
// ==========================================
export function openQuoteBuilder() {
  if (!currentDeal) {
    toast.error('Please select a deal first', 'Error');
    return;
  }

  quoteLineItems = { good: [], better: [], best: [] };
  renderQuoteBuilder();
  document.getElementById('quote-builder-modal').classList.remove('hidden');
}

function renderQuoteBuilder() {
  // Render line items for each tier
  ['good', 'better', 'best'].forEach(tier => {
    const container = document.getElementById(`${tier}-tier-items`);
    if (!container) return;

    if (quoteLineItems[tier].length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">No items yet</p>';
    } else {
      container.innerHTML = quoteLineItems[tier].map((item, index) => {
        const name = (item.name || '').replace(/"/g, '&quot;');
        return `
        <div class="flex gap-2 items-start p-3 border border-nfgray dark:border-gray-700 rounded-lg">
          <div class="flex-1">
            <input type="text" value="${name}" placeholder="Item name" class="w-full px-2 py-1 text-sm border border-nfgray dark:border-gray-600 rounded bg-white dark:bg-gray-800 mb-2 quote-line-item" data-tier="${tier}" data-index="${index}" data-field="name">
            <input type="number" value="${item.unit_price || 0}" step="0.01" placeholder="Unit price" class="w-full px-2 py-1 text-sm border border-nfgray dark:border-gray-600 rounded bg-white dark:bg-gray-800 quote-line-item" data-tier="${tier}" data-index="${index}" data-field="unit_price">
          </div>
          <button type="button" class="text-red-500 hover:text-red-700 remove-line-item" data-tier="${tier}" data-index="${index}">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      `;
      }).join('');
    }
  });

  // Attach event listeners for line item updates
  document.querySelectorAll('.quote-line-item').forEach(input => {
    input.addEventListener('input', (e) => {
      const tier = e.target.dataset.tier;
      const index = parseInt(e.target.dataset.index);
      const field = e.target.dataset.field;
      const value = field === 'unit_price' ? parseFloat(e.target.value) || 0 : e.target.value;
      
      if (quoteLineItems[tier] && quoteLineItems[tier][index]) {
        quoteLineItems[tier][index][field] = value;
        if (field === 'unit_price') {
          quoteLineItems[tier][index].total_price = value * (quoteLineItems[tier][index].quantity || 1);
        }
        updateQuoteTotal();
      }
    });
  });

  // Attach event listeners for remove buttons
  document.querySelectorAll('.remove-line-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tier = e.target.closest('button').dataset.tier;
      const index = parseInt(e.target.closest('button').dataset.index);
      removeQuoteLineItem(tier, index);
    });
  });

  updateQuoteTotal();
  if (window.lucide) lucide.createIcons();
}

export function addQuoteLineItem(tier) {
  quoteLineItems[tier].push({
    name: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    total_price: 0
  });
  renderQuoteBuilder();
}

export function removeQuoteLineItem(tier, index) {
  quoteLineItems[tier].splice(index, 1);
  renderQuoteBuilder();
}

function updateQuoteTotal() {
  let total = 0;
  ['good', 'better', 'best'].forEach(tier => {
    quoteLineItems[tier].forEach(item => {
      total += (item.unit_price || 0) * (item.quantity || 1);
    });
  });
  document.getElementById('quote-total').textContent = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function saveQuote(isDraft = false) {
  if (!currentDeal) {
    toast.error('No deal selected', 'Error');
    return;
  }

  try {
    const title = document.getElementById('quote-title-input').value;
    if (!title) {
      toast.error('Please enter a quote title', 'Error');
      return;
    }

    // Calculate total
    let total = 0;
    const allItems = [];
    ['good', 'better', 'best'].forEach(tier => {
      quoteLineItems[tier].forEach(item => {
        const itemTotal = (item.unit_price || 0) * (item.quantity || 1);
        total += itemTotal;
        if (item.name && item.unit_price) {
          allItems.push({
            tier,
            name: item.name,
            description: item.description || '',
            quantity: item.quantity || 1,
            unit_price: item.unit_price,
            total_price: itemTotal
          });
        }
      });
    });

    // Create quote
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        deal_id: currentDeal.id,
        title,
        total_amount: total,
        status: isDraft ? 'draft' : 'sent',
        sent_at: isDraft ? null : new Date().toISOString(),
        created_by: currentUser.id
      })
      .select()
      .single();

    if (quoteError) throw quoteError;

    // Create line items
    if (allItems.length > 0) {
      const lineItems = allItems.map((item, index) => ({
        quote_id: quote.id,
        tier: item.tier,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        display_order: index
      }));

      const { error: itemsError } = await supabase
        .from('quote_line_items')
        .insert(lineItems);

      if (itemsError) throw itemsError;
    }

    // Create timeline event
    await createTimelineEvent(currentDeal.id, 'quote', isDraft ? 'Quote Draft Created' : 'Quote Sent', title, {
      quoteId: quote.id,
      totalAmount: total
    });

    toast.success(isDraft ? 'Quote saved as draft' : 'Quote sent successfully', 'Success');
    closeQuoteBuilderModal();
    
    // Refresh quotes if on deal detail
    if (currentDeal) {
      await renderQuotes(currentDeal.id);
    }
  } catch (error) {
    console.error('[Sales] Error saving quote:', error);
    toast.error('Failed to save quote', 'Error');
  }
}

// ==========================================
// TIMELINE EVENTS
// ==========================================
async function createTimelineEvent(dealId, eventType, title, description, metadata = {}) {
  try {
    const { error } = await supabase
      .from('timeline_events')
      .insert({
        deal_id: dealId,
        event_type: eventType,
        title,
        description,
        metadata,
        created_by: currentUser.id
      });

    if (error) throw error;

    // Refresh timeline if on deal detail
    if (currentDeal && currentDeal.id === dealId) {
      await renderTimeline(dealId);
    }
  } catch (error) {
    console.error('[Sales] Error creating timeline event:', error);
  }
}

// ==========================================
// FOLLOW-UP SEQUENCES
// ==========================================
export async function pauseSequence(sequenceId) {
  try {
    const { error } = await supabase
      .from('follow_up_sequences')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString()
      })
      .eq('id', sequenceId);

    if (error) throw error;

    toast.success('Sequence paused', 'Success');
    if (currentDeal) await renderFollowUpSequences(currentDeal.id);
  } catch (error) {
    console.error('[Sales] Error pausing sequence:', error);
    toast.error('Failed to pause sequence', 'Error');
  }
}

export async function stopSequence(sequenceId) {
  try {
    const { error } = await supabase
      .from('follow_up_sequences')
      .update({
        status: 'stopped',
        stopped_at: new Date().toISOString()
      })
      .eq('id', sequenceId);

    if (error) throw error;

    toast.success('Sequence stopped', 'Success');
    if (currentDeal) await renderFollowUpSequences(currentDeal.id);
  } catch (error) {
    console.error('[Sales] Error stopping sequence:', error);
    toast.error('Failed to stop sequence', 'Error');
  }
}

// ==========================================
// QUO ACTIONS
// ==========================================
export async function handleCall() {
  if (!currentDeal) {
    toast.error('No deal selected', 'Error');
    return;
  }

  const site = currentDeal.sites || {};
  const phoneNumber = site.contact_phone;

  if (!phoneNumber) {
    toast.error('No phone number available for this site', 'Error');
    return;
  }

  try {
    await QuoAPI.launchCall(phoneNumber, currentDeal.id);
    
    // Show post-call panel
    document.getElementById('post-call-panel').classList.remove('hidden');
  } catch (error) {
    console.error('[Sales] Error handling call:', error);
  }
}

export async function handleText() {
  if (!currentDeal) {
    toast.error('No deal selected', 'Error');
    return;
  }

  const site = currentDeal.sites || {};
  const phoneNumber = site.contact_phone;

  if (!phoneNumber) {
    toast.error('No phone number available for this site', 'Error');
    return;
  }

  const message = prompt('Enter message:');
  if (!message) return;

  try {
    await QuoAPI.sendText(phoneNumber, message, currentDeal.id);
  } catch (error) {
    console.error('[Sales] Error handling text:', error);
  }
}

export async function handleEmail() {
  if (!currentDeal) {
    toast.error('No deal selected', 'Error');
    return;
  }

  const site = currentDeal.sites || {};
  const email = site.contact_email;

  if (!email) {
    toast.error('No email available for this site', 'Error');
    return;
  }

  const subject = prompt('Enter email subject:');
  if (!subject) return;

  const body = prompt('Enter email body:');
  if (!body) return;

  try {
    await QuoAPI.sendEmail(email, subject, body, currentDeal.id);
  } catch (error) {
    console.error('[Sales] Error handling email:', error);
  }
}

// ==========================================
// NEXT ACTION
// ==========================================
export async function saveNextAction() {
  if (!currentDeal) {
    toast.error('No deal selected', 'Error');
    return;
  }

  const action = document.getElementById('next-action-input').value;
  const date = document.getElementById('next-action-date-input').value;

  if (!action) {
    toast.error('Please enter a next action', 'Error');
    return;
  }

  try {
    const { error } = await supabase
      .from('deals')
      .update({
        next_action: action,
        next_action_date: date ? new Date(date).toISOString() : null
      })
      .eq('id', currentDeal.id);

    if (error) throw error;

    toast.success('Next action saved', 'Success');
    document.getElementById('post-call-panel').classList.add('hidden');
    
    // Refresh deal
    await openDealDetail(currentDeal.id);
  } catch (error) {
    console.error('[Sales] Error saving next action:', error);
    toast.error('Failed to save next action', 'Error');
  }
}

// ==========================================
// MODAL FUNCTIONS
// ==========================================
function closeCreateDealModal() {
  document.getElementById('create-deal-modal').classList.add('hidden');
  document.getElementById('create-deal-form').reset();
}

function closeQuoteBuilderModal() {
  document.getElementById('quote-builder-modal').classList.add('hidden');
  document.getElementById('quote-builder-form').reset();
  quoteLineItems = { good: [], better: [], best: [] };
}

// ==========================================
// EVENT LISTENERS
// ==========================================
async function setupEventListeners() {
  // Create deal button
  document.getElementById('create-deal-btn')?.addEventListener('click', () => {
    document.getElementById('create-deal-modal').classList.remove('hidden');
  });
  document.getElementById('create-first-deal-btn')?.addEventListener('click', () => {
    document.getElementById('create-deal-modal').classList.remove('hidden');
  });

  // Close modals
  document.getElementById('close-create-deal-modal')?.addEventListener('click', closeCreateDealModal);
  document.getElementById('cancel-create-deal')?.addEventListener('click', closeCreateDealModal);
  document.getElementById('close-quote-builder-modal')?.addEventListener('click', closeQuoteBuilderModal);
  document.getElementById('cancel-quote-builder')?.addEventListener('click', closeQuoteBuilderModal);

  // Create deal form
  document.getElementById('create-deal-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
      siteId: document.getElementById('deal-site-select').value,
      priority: document.getElementById('deal-priority-select').value,
      value: document.getElementById('deal-value-input').value,
      notes: document.getElementById('deal-notes-input').value
    };
    await createDeal(formData);
  });

  // Back to queue
  document.getElementById('back-to-queue-btn')?.addEventListener('click', () => {
    document.getElementById('deal-queue-view').classList.remove('hidden');
    document.getElementById('deal-detail-view').classList.add('hidden');
    document.getElementById('back-to-queue-btn').classList.add('hidden');
    currentDeal = null;
  });

  // Deal actions
  document.getElementById('call-deal-btn')?.addEventListener('click', handleCall);
  document.getElementById('text-deal-btn')?.addEventListener('click', handleText);
  document.getElementById('email-deal-btn')?.addEventListener('click', handleEmail);
  document.getElementById('create-quote-btn')?.addEventListener('click', openQuoteBuilder);
  document.getElementById('new-quote-btn')?.addEventListener('click', openQuoteBuilder);

  // Quote builder - use event delegation for dynamic buttons
  document.getElementById('quote-builder-modal')?.addEventListener('click', (e) => {
    const addBtn = e.target.closest('.add-line-item-btn');
    if (addBtn) {
      const tier = addBtn.dataset.tier;
      addQuoteLineItem(tier);
    }
  });

  document.getElementById('save-draft-quote')?.addEventListener('click', () => saveQuote(true));
  document.getElementById('quote-builder-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveQuote(false);
  });

  // Next action
  document.getElementById('save-next-action-btn')?.addEventListener('click', saveNextAction);
}

// Export functions for external use
export { QuoAPI, loadDeals };
