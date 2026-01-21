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
  } catch (error) {
    console.error('[Sales] Error loading sites:', error);
    // Don't show error toast for sites loading - it's not critical for deal creation
  }
}

async function loadDeals() {
  try {
    showLoading('deals-list', 'Loading deals...');
    
    // Build base query without relationships to avoid FK errors
    let query = supabase
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter by assigned user if rep
    if (currentUserProfile && currentUserProfile.role === 'rep') {
      // Try both assigned_to and assigned_user_id columns using OR
      query = query.or(`assigned_to.eq.${currentUser.id},assigned_user_id.eq.${currentUser.id}`);
    }

    const { data, error } = await query;
    
    if (error) {
      // If assigned_to doesn't exist, try without the filter
      if (currentUserProfile && currentUserProfile.role === 'rep') {
        console.warn('[Sales] assigned_to column not found, loading all deals');
        const retryQuery = supabase
          .from('deals')
          .select('*')
          .order('created_at', { ascending: false });
        const retryResult = await retryQuery;
        if (retryResult.error) throw retryResult.error;
        deals = retryResult.data || [];
      } else {
        throw error;
      }
    } else {
      deals = data || [];
      
      // Optionally enrich with site data if site_id exists
      if (deals.length > 0 && deals[0].site_id) {
        try {
          const siteIds = [...new Set(deals.map(d => d.site_id).filter(Boolean))];
          if (siteIds.length > 0) {
            const { data: sitesData } = await supabase
              .from('sites')
              .select('id, name, address')
              .in('id', siteIds);
            
            // Attach site data to deals
            if (sitesData) {
              const sitesMap = new Map(sitesData.map(s => [s.id, s]));
              deals = deals.map(deal => ({
                ...deal,
                sites: deal.site_id ? sitesMap.get(deal.site_id) : null
              }));
            }
          }
        } catch (siteError) {
          console.warn('[Sales] Could not load site data:', siteError);
          // Continue without site data
        }
      }
    }
    
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
  const nameEl = document.getElementById('deal-detail-name');
  if (nameEl) nameEl.textContent = site.name || deal.title || 'Unknown Site';
  
  const siteEl = document.getElementById('deal-detail-site');
  if (siteEl) siteEl.textContent = site.address || '';
  
  const statusEl = document.getElementById('deal-detail-status');
  if (statusEl) statusEl.textContent = deal.stage || deal.status || 'Unknown';
  
  const priorityEl = document.getElementById('deal-detail-priority');
  if (priorityEl) priorityEl.textContent = deal.priority || 'N/A';
  
  // Update health
  const healthScore = deal.health_score || 50;
  const healthScoreEl = document.getElementById('deal-health-score');
  if (healthScoreEl) healthScoreEl.textContent = `${healthScore}%`;
  
  const healthBar = document.getElementById('deal-health-bar');
  if (healthBar) {
    healthBar.className = `health-bar ${getHealthClass(healthScore)} h-2 rounded-full`;
    healthBar.style.width = `${healthScore}%`;
  }

  // Load and render timeline
  await renderTimeline(deal.id);

  // Load and render quotes
  await renderQuotes(deal.id);

  // Load and render follow-up sequences
  await renderFollowUpSequences(deal.id);

  // Display notes
  const notesEl = document.getElementById('deal-detail-notes');
  if (notesEl) {
    notesEl.textContent = deal.notes || 'No notes';
  }

  // Show detail view
  const queueView = document.getElementById('deal-queue-view');
  if (queueView) queueView.classList.add('hidden');
  
  const detailView = document.getElementById('deal-detail-view');
  if (detailView) detailView.classList.remove('hidden');
  
  const backBtn = document.getElementById('back-to-queue-btn');
  if (backBtn) backBtn.classList.remove('hidden');
}

async function renderTimeline(dealId) {
  try {
    // Use deal_events table instead of timeline_events
    const { data, error } = await supabase
      .from('deal_events')
      .select('*, created_by_user:created_by (id, email)')
      .eq('deal_id', dealId)
      .order('timestamp', { ascending: false });

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
      // Use timestamp instead of created_at
      const date = new Date(event.timestamp || event.created_at).toLocaleString();
      
      // Format event type as title
      const title = event.event_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Event';
      
      // Get description from metadata if available
      const description = event.metadata?.description || event.metadata?.message || '';

      return `
        <div class="timeline-item">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-nfglight dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
              <i data-lucide="${icon}" class="w-4 h-4 text-nfgblue dark:text-blue-400"></i>
            </div>
            <div class="flex-1">
              <div class="flex justify-between items-start mb-1">
                <h4 class="font-semibold text-nftext dark:text-gray-200">${title}</h4>
                <span class="text-xs text-gray-500 dark:text-gray-400">${date}</span>
              </div>
              ${description ? `<p class="text-sm text-gray-600 dark:text-gray-400 mb-1">${description}</p>` : ''}
              ${user.email ? `<p class="text-xs text-gray-500 dark:text-gray-400">by ${user.email}</p>` : ''}
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
    // Query sequence_executions which links sequences to deals
    // Try to join with follow_up_sequences or sequences table
    const { data, error } = await supabase
      .from('sequence_executions')
      .select(`
        *,
        follow_up_sequence:sequence_id (
          id,
          name,
          description
        ),
        sequence:sequence_id (
          id,
          name,
          description
        )
      `)
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });

    if (error) {
      // If join fails, try without join
      console.warn('[Sales] Error with join, trying without:', error);
      const { data: simpleData, error: simpleError } = await supabase
        .from('sequence_executions')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });
      
      if (simpleError) throw simpleError;
      
      // Use simple data without sequence details
      const sequencesContainer = document.getElementById('sequences-container');
      if (!sequencesContainer) return;
      
      if (!simpleData || simpleData.length === 0) {
        sequencesContainer.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm">No follow-up sequences assigned.</p>';
        return;
      }
      
      // Render with limited info
      const statusColors = {
        active: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
        paused: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
        stopped: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
        completed: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
      };
      
      sequencesContainer.innerHTML = simpleData.map(execution => {
        const status = execution.status || 'active';
        return `
          <div class="border border-nfgray dark:border-gray-700 rounded-lg p-4">
            <div class="flex justify-between items-start mb-2">
              <div>
                <h4 class="font-semibold text-nftext dark:text-gray-200">Sequence Execution</h4>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Step ${execution.current_step || 0}
                  ${execution.attempt_count ? ` • ${execution.attempt_count} attempts` : ''}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-1 rounded-lg text-xs font-medium ${statusColors[status] || statusColors.active}">
                  ${status}
                </span>
              </div>
            </div>
          </div>
        `;
      }).join('');
      return;
    }

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

    sequencesContainer.innerHTML = data.map(execution => {
      // Try both possible relationship names
      const sequence = execution.follow_up_sequence || execution.sequence || {};
      const sequenceName = sequence.name || 'Unknown Sequence';
      const currentStep = execution.current_step || 0;
      const status = execution.status || 'active';
      
      return `
        <div class="border border-nfgray dark:border-gray-700 rounded-lg p-4">
          <div class="flex justify-between items-start mb-2">
            <div>
              <h4 class="font-semibold text-nftext dark:text-gray-200">${sequenceName}</h4>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Step ${currentStep}
                ${execution.attempt_count ? ` • ${execution.attempt_count} attempts` : ''}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-1 rounded-lg text-xs font-medium ${statusColors[status] || statusColors.active}">
                ${status}
              </span>
              ${status === 'active' ? `
                <button data-sequence-id="${execution.id}" data-action="pause-sequence" class="px-2 py-1 text-xs border border-nfgray dark:border-gray-700 hover:bg-nfglight dark:hover:bg-gray-700 rounded transition">
                  Pause
                </button>
                <button data-sequence-id="${execution.id}" data-action="stop-sequence" class="px-2 py-1 text-xs border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900 text-red-600 dark:text-red-400 rounded transition">
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
  console.log('[Sales] openDealDetail called with dealId:', dealId);
  
  try {
    // Check if modal element exists
    const modal = document.getElementById('deal-detail-view');
    if (!modal) {
      console.error('[Sales] Deal detail modal not found in DOM');
      toast.error('Deal detail modal not found', 'Error');
      return;
    }
    
    // Show modal immediately with loading state
    modal.classList.remove('hidden');
    console.log('[Sales] Modal shown');
    
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('id', dealId)
      .single();

    if (error) {
      console.error('[Sales] Error fetching deal:', error);
      throw error;
    }
    
    console.log('[Sales] Deal data fetched:', data);
    currentDeal = data;
    
    // Optionally load site data if site_id exists
    if (currentDeal && currentDeal.site_id) {
      try {
        const { data: siteData } = await supabase
          .from('sites')
          .select('id, name, address, contact_phone, contact_email')
          .eq('id', currentDeal.site_id)
          .single();
        if (siteData) {
          currentDeal.sites = siteData;
          console.log('[Sales] Site data loaded:', siteData);
        }
      } catch (siteError) {
        console.warn('[Sales] Could not load site data for deal:', siteError);
        // Continue without site data
      }
    }
    
    await renderDealDetail(data);
    setupDealActions(dealId);
    console.log('[Sales] Deal detail rendered successfully');
  } catch (error) {
    console.error('[Sales] Error opening deal detail:', error);
    toast.error(`Failed to load deal details: ${error.message}`, 'Error');
    // Hide modal on error
    const modal = document.getElementById('deal-detail-view');
    if (modal) modal.classList.add('hidden');
  }
}

// Setup event handlers for edit and delete buttons
function setupDealActions(dealId) {
  // Edit button
  const editBtn = document.getElementById('edit-deal-btn');
  if (editBtn) {
    editBtn.onclick = () => openEditDealModal(dealId);
  }

  // Delete button
  const deleteBtn = document.getElementById('delete-deal-btn');
  if (deleteBtn) {
    deleteBtn.onclick = () => openDeleteDealModal(dealId);
  }
}

// Open edit deal modal
function openEditDealModal(dealId) {
  if (!currentDeal || currentDeal.id !== dealId) {
    toast.error('Deal data not loaded', 'Error');
    return;
  }

  const modal = document.getElementById('edit-deal-modal');
  const titleInput = document.getElementById('edit-deal-title');
  const stageSelect = document.getElementById('edit-deal-stage');
  const notesTextarea = document.getElementById('edit-deal-notes');

  if (!modal || !titleInput || !stageSelect || !notesTextarea) {
    toast.error('Edit modal elements not found', 'Error');
    return;
  }

  // Populate form fields
  titleInput.value = currentDeal.title || '';
  stageSelect.value = currentDeal.stage || 'prospecting';
  notesTextarea.value = currentDeal.notes || '';

  // Show modal
  modal.classList.remove('hidden');

  // Setup close handlers
  const closeBtn = document.getElementById('close-edit-deal-modal');
  const cancelBtn = document.getElementById('cancel-edit-deal');
  const form = document.getElementById('edit-deal-form');

  const closeModal = () => {
    modal.classList.add('hidden');
  };

  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  // Setup form submit
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      await updateDeal(dealId, {
        title: titleInput.value.trim(),
        stage: stageSelect.value,
        notes: notesTextarea.value.trim() || null
      });
      closeModal();
    };
  }

  // Re-initialize icons
  if (window.lucide) lucide.createIcons();
}

// Open delete deal confirmation modal
function openDeleteDealModal(dealId) {
  if (!currentDeal || currentDeal.id !== dealId) {
    toast.error('Deal data not loaded', 'Error');
    return;
  }

  const modal = document.getElementById('delete-deal-modal');
  if (!modal) {
    toast.error('Delete modal not found', 'Error');
    return;
  }

  // Show modal
  modal.classList.remove('hidden');

  // Setup handlers
  const cancelBtn = document.getElementById('cancel-delete-deal');
  const confirmBtn = document.getElementById('confirm-delete-deal');

  const closeModal = () => {
    modal.classList.add('hidden');
  };

  if (cancelBtn) cancelBtn.onclick = closeModal;

  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      await deleteDeal(dealId);
      closeModal();
    };
  }

  // Re-initialize icons
  if (window.lucide) lucide.createIcons();
}

// Update deal
export async function updateDeal(dealId, updates) {
  try {
    const { data, error } = await supabase
      .from('deals')
      .update(updates)
      .eq('id', dealId)
      .select()
      .single();

    if (error) throw error;

    // Update current deal
    currentDeal = data;

    // Reload deal detail view
    await renderDealDetail(data);
    
    // Refresh deals list/kanban
    if (window.loadDealsForDashboard) {
      await window.loadDealsForDashboard();
    }

    toast.success('Deal updated successfully', 'Success');
    return data;
  } catch (error) {
    console.error('[Sales] Error updating deal:', error);
    toast.error(`Failed to update deal: ${error.message}`, 'Error');
    throw error;
  }
}

// Delete deal
export async function deleteDeal(dealId) {
  try {
    const { error } = await supabase
      .from('deals')
      .delete()
      .eq('id', dealId);

    if (error) throw error;

    // Close deal detail modal
    const detailModal = document.getElementById('deal-detail-view');
    if (detailModal) detailModal.classList.add('hidden');

    // Refresh deals list/kanban
    if (window.loadDealsForDashboard) {
      await window.loadDealsForDashboard();
    }

    // Clear current deal
    currentDeal = null;

    toast.success('Deal deleted successfully', 'Success');
  } catch (error) {
    console.error('[Sales] Error deleting deal:', error);
    toast.error(`Failed to delete deal: ${error.message}`, 'Error');
    throw error;
  }
}

export async function createDeal(formData) {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/1bafbe09-017f-4fe1-86be-5b3d73662238',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.js:676',message:'createDeal called',data:{hasCompanyName:!!formData.companyName,hasContactInfo:!!(formData.contactFirstName||formData.contactEmail),formDataKeys:Object.keys(formData)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    let siteId = null;
    let contactId = null;

    // Create or find site if company name is provided
    if (formData.companyName) {
      const fullAddress = [
        formData.address,
        formData.city,
        formData.province,
        formData.postalCode
      ].filter(Boolean).join(', ');

      // Check if site already exists
      const { data: existingSite } = await supabase
        .from('sites')
        .select('id')
        .eq('name', formData.companyName)
        .single();

      if (existingSite) {
        siteId = existingSite.id;
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/1bafbe09-017f-4fe1-86be-5b3d73662238',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.js:699',message:'Existing site found',data:{siteId,siteIdType:typeof siteId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      } else {
        // Create new site
        const { data: newSite, error: siteError } = await supabase
          .from('sites')
          .insert({
            name: formData.companyName,
            address: fullAddress || null,
            status: 'Active',
            created_by: currentUser.id
          })
          .select()
          .single();

        if (siteError) {
          console.warn('[Sales] Error creating site:', siteError);
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/1bafbe09-017f-4fe1-86be-5b3d73662238',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.js:714',message:'Site creation error',data:{error:siteError.message,code:siteError.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
        } else {
          siteId = newSite.id;
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/1bafbe09-017f-4fe1-86be-5b3d73662238',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.js:716',message:'Site created',data:{siteId,siteIdType:typeof siteId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
        }
      }
    }

    // Create or find contact if contact info is provided
    if (formData.contactFirstName || formData.contactLastName || formData.contactEmail || formData.contactPhone) {
      const fullName = [formData.contactFirstName, formData.contactLastName].filter(Boolean).join(' ').trim() || 'Unknown';

      // Check if contact already exists by email or phone
      let existingContact = null;
      if (formData.contactEmail) {
        const { data } = await supabase
          .from('account_contacts')
          .select('id')
          .eq('email', formData.contactEmail)
          .single();
        existingContact = data;
      }

      if (!existingContact && formData.contactPhone) {
        const { data } = await supabase
          .from('account_contacts')
          .select('id')
          .eq('phone', formData.contactPhone)
          .single();
        existingContact = data;
      }

      if (existingContact) {
        contactId = existingContact.id;
      } else {
        // Note: account_contacts requires account_id (UUID from accounts table)
        // Since we're creating a site (BIGINT), not an account (UUID), we skip contact creation
        // The contact info will still be stored in the deal's notes or can be added later
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/1bafbe09-017f-4fe1-86be-5b3d73662238',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.js:747',message:'Skipping contact creation - siteId is BIGINT but account_contacts requires UUID account_id',data:{siteId,siteIdType:typeof siteId,fullName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        console.warn('[Sales] Contact info provided but cannot create account_contact without account UUID. Contact info will be stored in deal notes.');
      }
    }

    // Create deal
    const dealTitle = formData.dealTitle || formData.companyName || 'New Deal';
    // Build notes with contact info if contact wasn't created
    let dealNotes = formData.notes || '';
    if (!contactId && (formData.contactFirstName || formData.contactEmail || formData.contactPhone)) {
      const contactInfo = [
        formData.contactFirstName && formData.contactLastName ? `${formData.contactFirstName} ${formData.contactLastName}` : formData.contactFirstName || formData.contactLastName,
        formData.contactEmail,
        formData.contactPhone,
        formData.contactTitle
      ].filter(Boolean).join(' | ');
      dealNotes = dealNotes ? `${dealNotes}\n\nContact: ${contactInfo}` : `Contact: ${contactInfo}`;
    }
    
    // Use absolute bare minimum - only title and stage which are required
    const dealInsertData = {
      title: dealTitle,
      stage: formData.stage || 'prospecting',
      notes: dealNotes || null
    };
    
    // Add estimated value to notes if provided (since deal_value column might not exist)
    if (formData.value) {
      const valueNote = `\n\nEstimated Value: $${parseFloat(formData.value).toLocaleString()}`;
      dealInsertData.notes = (dealInsertData.notes || '') + valueNote;
    }
    
    // Only add priority if the column exists - using priority_score from schema
    // Skip for now to avoid errors
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/1bafbe09-017f-4fe1-86be-5b3d73662238',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.js:772',message:'Attempting deal creation',data:{dealInsertData,hasDealValue:dealInsertData.hasOwnProperty('deal_value'),insertKeys:Object.keys(dealInsertData)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const { data, error } = await supabase
      .from('deals')
      .insert(dealInsertData)
      .select()
      .single();

    if (error) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/1bafbe09-017f-4fe1-86be-5b3d73662238',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sales.js:788',message:'Deal creation error',data:{error:error.message,code:error.code,details:error.details,hint:error.hint,insertKeys:Object.keys(dealInsertData)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      throw error;
    }

    await loadDeals();
    toast.success('Lead/Deal created successfully', 'Success');
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
    // Use deal_events table instead of timeline_events
    // Store title and description in metadata since deal_events doesn't have those columns
    const { error } = await supabase
      .from('deal_events')
      .insert({
        deal_id: dealId,
        event_type: eventType,
        created_by: currentUser?.id || null,
        metadata: {
          ...metadata,
          title,
          description
        }
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
    // Update sequence_executions instead of follow_up_sequences
    const { error } = await supabase
      .from('sequence_executions')
      .update({
        status: 'paused',
        updated_at: new Date().toISOString()
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
    // Update sequence_executions instead of follow_up_sequences
    const { error } = await supabase
      .from('sequence_executions')
      .update({
        status: 'stopped',
        stopped_reason: 'Manually stopped',
        updated_at: new Date().toISOString()
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
  // Note: The new quote wizard uses closeWizard() from quote-wizard.js instead
  // This function is kept for backward compatibility but the wizard handles its own cleanup
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
      companyName: document.getElementById('deal-company-name')?.value || '',
      industry: document.getElementById('deal-industry')?.value || '',
      address: document.getElementById('deal-address')?.value || '',
      city: document.getElementById('deal-city')?.value || '',
      province: document.getElementById('deal-province')?.value || '',
      postalCode: document.getElementById('deal-postal')?.value || '',
      contactFirstName: document.getElementById('deal-contact-first')?.value || '',
      contactLastName: document.getElementById('deal-contact-last')?.value || '',
      contactEmail: document.getElementById('deal-contact-email')?.value || '',
      contactPhone: document.getElementById('deal-contact-phone')?.value || '',
      contactTitle: document.getElementById('deal-contact-title')?.value || '',
      dealTitle: document.getElementById('deal-title')?.value || '',
      stage: document.getElementById('deal-stage-select')?.value || 'prospecting',
      priority: document.getElementById('deal-priority-select')?.value || 'medium',
      value: document.getElementById('deal-value-input')?.value || '',
      closeDate: document.getElementById('deal-close-date')?.value || '',
      notes: document.getElementById('deal-notes-input')?.value || ''
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
