console.log('UI module loaded.')

// Import notification system
import { showNotification, showConfirm, showPrompt, toast, notify } from './notifications.js'

// Current filter state
let currentFilter = 'all'
// Store sites for filtering
let cachedSites = []
let cachedRenderOptions = {}

// Render sites to the grid
export async function renderSites(sites, options = {}) {
  console.log('[UI] Rendering sites:', sites?.length || 0, 'sites')
  const grid = document.getElementById('sites-grid')
  if (!grid) {
    console.error('[UI] ❌ sites-grid element not found!')
    return
  }
  
  // Cache sites and options for filtering
  cachedSites = sites || []
  cachedRenderOptions = options || {}
  
  // Show skeleton loading if this is initial load
  if (options.showSkeleton && sites.length === 0) {
    try {
      const { createSkeletonGrid, createSkeletonSiteCard, showSkeleton } = await import('./skeleton.js');
      showSkeleton(grid, createSkeletonGrid(6, createSkeletonSiteCard));
      // Sites will be loaded and re-rendered, so return early
      return;
    } catch (error) {
      console.error('[UI] Error loading skeleton:', error);
    }
  }
  
  // Apply current filter
  const filteredSites = filterSites(sites, currentFilter)
  console.log('[UI] Filtered sites:', filteredSites?.length || 0, 'sites')
  
  // Get current user profile for bulk operations
  let currentUserProfile = options.currentUserProfile || null;
  if (!currentUserProfile && typeof window !== 'undefined' && window.currentUserProfile) {
    currentUserProfile = window.currentUserProfile;
  }
  
  // Get selected sites from global state
  let selectedSites = new Set();
  if (typeof window !== 'undefined' && window.selectedSites) {
    selectedSites = window.selectedSites;
  }

  // Show/hide Select All checkbox based on role
  const selectAllContainer = document.getElementById('select-all-sites-container');
  const isStaff = currentUserProfile && currentUserProfile.role === 'staff';
  if (selectAllContainer) {
    if (isStaff) {
      selectAllContainer.classList.add('hidden');
    } else {
      selectAllContainer.classList.remove('hidden');
    }
  }
  
  if (filteredSites.length === 0) {
    // Show different empty state based on whether we have sites or not
    const hasAnySites = sites.length > 0
    grid.innerHTML = createEmptyState(hasAnySites)
  } else {
    grid.innerHTML = filteredSites.map(site => {
      const isSelected = selectedSites.has(site.id);
      return createSiteCard(site, { currentUserProfile, isSelected });
    }).join('')
    console.log('[UI] ✅ Sites rendered! Check for View Site buttons with data-action="view-site"')
    
    // Initialize Lucide icons
    if (window.lucide) {
      lucide.createIcons();
    }

    // Attach checkbox listeners after rendering
    if (typeof window !== 'undefined' && window.attachSiteCheckboxListeners) {
      window.attachSiteCheckboxListeners();
    }

    // Update select all checkbox state
    if (typeof window !== 'undefined' && window.updateSelectAllSitesCheckbox) {
      window.updateSelectAllSitesCheckbox();
    }
  }
}

// Filter sites based on status
function filterSites(sites, filter) {
  if (filter === 'all') {
    return sites
  }
  return sites.filter(site => site.status === filter)
}

// Apply filter and update UI
async function applyFilter(filterValue) {
  currentFilter = filterValue
  console.log('[UI] Applying filter:', filterValue)
  
  // Update filter label
  const filterLabel = document.getElementById('filter-label')
  if (filterLabel) {
    if (filterValue === 'all') {
      filterLabel.textContent = 'All Sites'
    } else {
      // Capitalize first letter
      filterLabel.textContent = filterValue.charAt(0).toUpperCase() + filterValue.slice(1) + ' Sites'
    }
  }
  
  // Close the dropdown
  const dropdown = document.getElementById('sites-filter')
  if (dropdown) {
    dropdown.classList.add('hidden')
  }
  
  // Re-render sites with new filter using cached sites
  if (cachedSites.length > 0) {
    await renderSites(cachedSites, cachedRenderOptions)
  } else {
    // Fallback: try to get sites from dashboard if available
    if (typeof window.fetchSites === 'function') {
      const sites = await window.fetchSites()
      await renderSites(sites, cachedRenderOptions)
    }
  }
}

// Create empty state when no sites exist
function createEmptyState(hasAnySites = false) {
  if (hasAnySites && currentFilter !== 'all') {
    // Show "no sites match filter" message
    return `
      <div class="col-span-full flex flex-col items-center justify-center py-16 px-4">
        <div class="bg-white dark:bg-gray-800 border-2 border-dashed border-nfgray dark:border-gray-700 rounded-xl p-12 max-w-md text-center">
          <svg class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <h3 class="text-nfgblue dark:text-blue-400 font-semibold text-xl mb-2">No Sites Found</h3>
          <p class="text-nftext dark:text-gray-300 text-sm mb-6">No sites match the "${currentFilter}" status. Try selecting a different filter.</p>
          <button 
            data-action="filter-sites"
            data-value="all"
            class="bg-nfgblue hover:bg-nfgdark text-white rounded-xl px-6 py-3 font-medium transition inline-flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
            </svg>
            Show All Sites
          </button>
        </div>
      </div>
    `
  }
  
  // Show "no sites at all" message
  return `
    <div class="col-span-full flex flex-col items-center justify-center py-16 px-4">
      <div class="bg-white dark:bg-gray-800 border-2 border-dashed border-nfgray dark:border-gray-700 rounded-xl p-12 max-w-md text-center">
        <svg class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
        </svg>
        <h3 class="text-nfgblue dark:text-blue-400 font-semibold text-xl mb-2">No Sites Yet</h3>
        <p class="text-nftext dark:text-gray-300 text-sm mb-6">Get started by adding your first site. Sites represent the buildings or properties you manage.</p>
        <button 
          data-action="add-site"
          class="bg-nfgblue hover:bg-nfgdark text-white rounded-xl px-6 py-3 font-medium transition inline-flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Add Your First Site
        </button>
      </div>
    </div>
  `
}

// Create a site card HTML
function createSiteCard(site, options = {}) {
  const { currentUserProfile = null, isSelected = false } = options;
  const statusColors = {
    'Active': 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
    'Paused': 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
    'In Setup': 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
  }
  
  const statusClass = statusColors[site.status] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
  const isStaff = currentUserProfile && currentUserProfile.role === 'staff';
  const canBulkOperate = !isStaff && currentUserProfile && (currentUserProfile.role === 'admin' || currentUserProfile.role === 'client' || currentUserProfile.role === 'super_admin');
  
  return `
    <div class="bg-white dark:bg-gray-800 border ${isSelected ? 'border-nfgblue ring-2 ring-nfgblue' : 'border-nfgray dark:border-gray-700'} rounded-xl p-4 shadow-nfg hover:shadow-lg transition-shadow ${isSelected ? 'bg-nfglight/30 dark:bg-blue-900/20' : ''}">
      <!-- Header -->
      <div class="flex justify-between items-start mb-3">
        <div class="flex items-start gap-3 flex-1 min-w-0">
          ${canBulkOperate ? `
            <input 
              type="checkbox" 
              class="site-checkbox w-4 h-4 text-nfgblue border-nfgray rounded focus:ring-nfgblue cursor-pointer mt-1 flex-shrink-0" 
              data-site-id="${site.id}"
              ${isSelected ? 'checked' : ''}
              aria-label="Select site ${site.name}"
            />
          ` : ''}
        <div class="flex-1 min-w-0">
          <h3 class="text-nfgblue dark:text-blue-400 font-semibold text-lg">${site.name}</h3>
          <div class="flex items-center gap-2 mt-1">
            <p class="text-gray-500 dark:text-gray-400 text-xs truncate">${site.address}</p>
            <button 
              onclick="copyAddress('${site.address.replace(/'/g, "\\'")}', event)" 
              class="text-gray-400 hover:text-nfgblue dark:hover:text-blue-400 transition p-1 rounded hover:bg-nfglight dark:hover:bg-gray-700 flex-shrink-0">
              <i data-lucide="copy" class="w-3 h-3"></i>
            </button>
            </div>
          </div>
        </div>
        <span class="px-2 py-1 rounded-lg text-xs font-medium ${statusClass} ml-2 flex-shrink-0">${site.status}</span>
      </div>
      
      <!-- KPIs -->
      <div class="grid grid-cols-3 gap-2 mb-4 py-3 border-t border-b border-nfgray dark:border-gray-700">
        <div class="text-center">
          <p class="text-nfgblue dark:text-blue-400 text-xl font-semibold">${site.jobs_completed || 0}</p>
          <p class="text-gray-500 dark:text-gray-400 text-xs">Jobs Done</p>
        </div>
        <div class="text-center">
          <p class="text-nfgblue dark:text-blue-400 text-xl font-semibold">${site.upcoming_bookings || 0}</p>
          <p class="text-gray-500 dark:text-gray-400 text-xs">Upcoming</p>
        </div>
        <div class="text-center">
          <p class="text-nfgblue dark:text-blue-400 text-xl font-semibold">${site.deal_value ? Number(site.deal_value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0'}</p>
          <p class="text-gray-500 dark:text-gray-400 text-xs">Deal Value</p>
        </div>
      </div>
      
      <!-- Action Button -->
      <button 
        data-action="view-site" 
        data-site-id="${site.id}"
        class="w-full bg-nfgblue hover:bg-nfgdark text-white rounded-xl py-2 text-sm font-medium transition">
        View Site
      </button>
    </div>
  `
}

// Track if UI has been initialized to prevent duplicate listeners
let uiInitialized = false

// Initialize UI event handlers
export function initializeUI() {
  if (uiInitialized) {
    console.log('[UI] Already initialized, skipping...')
    return
  }
  
  console.log('[UI] Initializing UI event handlers...')
  uiInitialized = true
  
  // Handle all clicks with event delegation
  document.addEventListener('click', async (e) => {
    // View Site button
    const viewBtn = e.target.closest('[data-action="view-site"]')
    if (viewBtn) {
      e.preventDefault()
      e.stopPropagation()
      const siteId = viewBtn.dataset.siteId
      console.log(`[UI] ✅ View Site button clicked! Site ID: ${siteId}`)
      openSiteDetailModal(siteId)
      return
    }
    
    // Add Site button
    const addBtn = e.target.closest('[data-action="add-site"]')
    if (addBtn) {
      e.preventDefault()
      console.log('[UI] Add Site clicked')
      openAddSiteModal()
      return
    }
    
    // Delete Site button
    const deleteBtn = e.target.closest('[data-action="delete-site"]')
    if (deleteBtn) {
      e.preventDefault()
      // Check if user is staff - prevent deletion
      try {
        const { supabase } = await import('./supabase.js')
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          if (profile && profile.role === 'staff') {
            toast.error('Staff members cannot delete sites.', 'Access Denied')
            return
          }
        }
      } catch (error) {
        console.error('[UI] Error checking user role:', error)
      }
      console.log('[UI] Delete Site clicked')
      openDeleteConfirmModal()
      return
    }
    
    // Confirm Delete button
    const confirmDeleteBtn = e.target.closest('[data-action="confirm-delete-site"]')
    if (confirmDeleteBtn) {
      e.preventDefault()
      // Check if user is staff - prevent deletion
      try {
        const { supabase } = await import('./supabase.js')
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          if (profile && profile.role === 'staff') {
            toast.error('Staff members cannot delete sites.', 'Access Denied')
            return
          }
        }
      } catch (error) {
        console.error('[UI] Error checking user role:', error)
      }
      console.log('[UI] Confirm Delete Site clicked')
      deleteSite()
      return
    }
    
    // Filter Sites button
    const filterBtn = e.target.closest('[data-action="filter-sites"]')
    if (filterBtn) {
      e.preventDefault()
      const filterValue = filterBtn.dataset.value
      console.log('[UI] Filter Sites clicked:', filterValue)
      
      // Check if we're on dashboard (has allSites variable) or sites page
      if (typeof window.applySiteFilter === 'function') {
        // Dashboard has its own filter function
        window.applySiteFilter(filterValue)
      } else {
        // Fallback to ui.js filter (for sites.html)
        applyFilter(filterValue)
      }
      return
    }
    
    // Close modal buttons
    const closeModalBtn = e.target.closest('[data-action="close-modal"]')
    if (closeModalBtn) {
      e.preventDefault()
      const targetModal = closeModalBtn.dataset.target
      console.log('[UI] Close modal clicked:', targetModal)
      
      if (targetModal === 'siteDetailModal') {
        closeSiteDetailModal()
      } else if (targetModal === 'deleteSiteConfirmModal') {
        closeDeleteConfirmModal()
      }
      return
    }
  }, true) // Use capture phase to ensure we catch the event
  
  // Handle modal close buttons
  document.getElementById('cancel-modal')?.addEventListener('click', closeAddSiteModal)
  document.getElementById('close-modal-x')?.addEventListener('click', closeAddSiteModal)
  
  // Close modal when clicking outside
  document.getElementById('add-site-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'add-site-modal') {
      closeAddSiteModal()
    }
  })
  
  // Handle custom site filter dropdown
  const filterRadios = document.querySelectorAll('input[name="site-filter"]')
  filterRadios.forEach(radio => {
    radio.addEventListener('change', async (e) => {
      const filterId = e.target.id
      const filterValue = filterId.replace('filter-', '')
      console.log(`[UI] Filter changed to: ${filterValue}`)
      // Apply filter and re-render sites
      await applyFilter(filterValue)
    })
  })
  
  // Initialize sidebar toggle
  initSidebarToggle()
  
  // Initialize mobile sidebar
  initMobileSidebar()
  
  // Initialize user profile
  initUserProfile()
}

// Mobile sidebar toggle functionality
export function initMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  
  // Find all toggle buttons (hamburger menu buttons)
  const toggleButtons = document.querySelectorAll('[data-action="toggle-sidebar"], button[aria-label="Toggle sidebar"]');
  
  // Create overlay for mobile
  let overlay = document.getElementById('sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.className = 'fixed inset-0 bg-black/50 z-40 hidden';
    document.body.appendChild(overlay);
  }
  
  // Toggle sidebar function
  function toggleSidebar() {
    if (sidebar && overlay) {
      const isHidden = sidebar.classList.contains('hidden') || !sidebar.classList.contains('mobile-sidebar-open');
      
      if (isHidden) {
        // Show sidebar with better mobile styling
        sidebar.classList.remove('hidden');
        sidebar.classList.add(
          'mobile-sidebar-open',
          'flex', 
          'flex-col',
          'fixed', 
          'inset-y-0', 
          'left-0', 
          'z-50',
          'w-64',
          'max-w-[80vw]',
          'shadow-2xl',
          'animate-slide-in'
        );
        overlay.classList.remove('hidden');
        overlay.classList.add('animate-fade-in');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
      } else {
        // Hide sidebar with animation
        sidebar.classList.add('animate-slide-out');
        overlay.classList.add('animate-fade-out');
        
        // Wait for animation to complete
        setTimeout(() => {
          sidebar.classList.add('hidden');
          sidebar.classList.remove(
            'mobile-sidebar-open',
            'flex',
            'flex-col',
            'fixed', 
            'inset-y-0', 
            'left-0', 
            'z-50',
            'w-64',
            'max-w-[80vw]',
            'shadow-2xl',
            'animate-slide-in',
            'animate-slide-out'
          );
          overlay.classList.add('hidden');
          overlay.classList.remove('animate-fade-in', 'animate-fade-out');
          document.body.style.overflow = ''; // Restore scrolling
        }, 200);
      }
    }
  }
  
  // Attach click handlers to all toggle buttons
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSidebar();
    });
  });
  
  // Close sidebar when clicking overlay
  overlay?.addEventListener('click', toggleSidebar);
  
  // Close sidebar when clicking a nav link on mobile
  const navLinks = sidebar?.querySelectorAll('a');
  navLinks?.forEach(link => {
    link.addEventListener('click', () => {
      // Only close on mobile
      if (window.innerWidth < 768) {
        toggleSidebar();
      }
    });
  });
}

// Legacy sidebar toggle functionality (keep for compatibility)
function initSidebarToggle() {
  const sidebar = document.getElementById('sidebar')
  const toggleBtn = document.getElementById('sidebar-toggle')
  
  toggleBtn?.addEventListener('click', () => {
    sidebar?.classList.toggle('collapsed')
    
    // Save state to localStorage
    const isCollapsed = sidebar?.classList.contains('collapsed')
    localStorage.setItem('sidebar_collapsed', isCollapsed)
  })
  
  // Restore sidebar state from localStorage
  const savedState = localStorage.getItem('sidebar_collapsed')
  if (savedState === 'true') {
    sidebar?.classList.add('collapsed')
  }
}

// Initialize user profile in sidebar
async function initUserProfile() {
  // Get user from Supabase auth
  const { supabase } = await import('./supabase.js')
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    // Set user name
    const userName = user.email?.split('@')[0] || 'User'
    const userNameEl = document.getElementById('user-name')
    if (userNameEl) {
      userNameEl.textContent = userName.charAt(0).toUpperCase() + userName.slice(1)
    }
    
    // Set user initials
    const initials = userName.charAt(0).toUpperCase()
    const initialsEl = document.getElementById('user-initials')
    if (initialsEl) {
      initialsEl.textContent = initials
    }
  }
}

// Modal functions
function openAddSiteModal() {
  const modal = document.getElementById('addSiteModal')
  const form = document.getElementById('add-site-form')
  const errorEl = document.getElementById('form-error')
  
  if (modal) {
    modal.classList.remove('hidden')
    modal.classList.add('flex')
    form?.reset()
    errorEl?.classList.add('hidden')
  }
}

export function closeAddSiteModal() {
  const modal = document.getElementById('addSiteModal')
  const form = document.getElementById('add-site-form')
  const errorEl = document.getElementById('form-error')
  
  if (modal) {
    modal.classList.add('hidden')
    modal.classList.remove('flex')
    form?.reset()
    errorEl?.classList.add('hidden')
  }
}

// Store current site ID for delete operation
let currentSiteId = null

// Fetch and display recent pending/in-progress jobs for a site
async function fetchAndDisplayRecentSiteActivity(siteId) {
  try {
    const { supabase } = await import('./supabase.js');
    
    if (!supabase) {
      console.error('[UI] ❌ Supabase not available for recent activity');
      return;
    }

    console.log('[UI] 📋 Fetching recent pending/in-progress jobs for site:', siteId);

    // Query jobs that are pending OR in-progress for this site
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('id, title, status, job_type, created_at')
      .eq('site_id', siteId)
      .in('status', ['pending', 'in-progress'])
      .order('created_at', { ascending: false })
      .limit(5); // Show up to 5 recent jobs

    const recentActivityContainer = document.getElementById('site-detail-activity');
    if (!recentActivityContainer) {
      console.error('[UI] ❌ Recent activity container not found');
      return;
    }

    if (error) {
      console.error('[UI] ❌ Error fetching recent site activity:', error);
      recentActivityContainer.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm">Error loading recent jobs.</p>';
      return;
    }

    if (jobs && jobs.length > 0) {
      console.log('[UI] ✅ Found', jobs.length, 'active jobs for Recent Activity');
      
      // Build HTML for recent activity
      let activityHTML = '<div class="space-y-2">';
      jobs.forEach(job => {
        const statusIcon = job.status === 'pending' ? 'clock' : 'loader';
        const statusColor = job.status === 'pending' ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400';
        const isEmergency = job.job_type === 'emergency';
        
        activityHTML += `
          <div class="flex items-center gap-2 p-2 rounded-lg hover:bg-nfglight dark:hover:bg-gray-700 transition cursor-pointer border border-nfgray dark:border-gray-700" 
               onclick="window.location.href='jobs.html?job=${job.id}'">
            <i data-lucide="${statusIcon}" class="w-4 h-4 ${statusColor} flex-shrink-0"></i>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-nftext dark:text-gray-200 truncate">
                ${isEmergency ? '🚨 ' : ''}${job.title}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 capitalize">${job.status.replace('-', ' ')}</p>
            </div>
            <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0"></i>
          </div>
        `;
      });
      activityHTML += '</div>';
      
      recentActivityContainer.innerHTML = activityHTML;
      
      // Re-render lucide icons
      if (window.lucide) {
        setTimeout(() => window.lucide.createIcons(), 50);
      }
    } else {
      console.log('[UI] No active jobs found for Recent Activity');
      recentActivityContainer.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm">No pending or in-progress jobs.</p>';
    }

  } catch (error) {
    console.error('[UI] Unexpected error in fetchAndDisplayRecentSiteActivity:', error);
  }
}

// Calculate and display real-time site metrics
async function calculateAndDisplaySiteMetrics(siteId) {
  try {
    // Import supabase properly
    const { supabase } = await import('./supabase.js')
    
    if (!supabase) {
      console.error('[UI] ❌ Supabase not available after import')
      document.getElementById('site-detail-jobs').textContent = '0'
      document.getElementById('site-detail-bookings').textContent = '0'
      return
    }

    console.log('[UI] ✅ Supabase loaded successfully for metrics calculation')

    // Show loading state
    document.getElementById('site-detail-jobs').textContent = '...'
    document.getElementById('site-detail-bookings').textContent = '...'

    // 1. Count COMPLETED jobs for this site
    console.log('[UI] Querying completed jobs for site_id:', siteId, 'with status="completed"')
    const { count: completedJobs, error: jobsError } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'completed')

    if (jobsError) {
      console.error('[UI] ❌ Error counting completed jobs:', jobsError)
      document.getElementById('site-detail-jobs').textContent = '0'
    } else {
      console.log('[UI] ✅ Jobs Completed for this site:', completedJobs)
      document.getElementById('site-detail-jobs').textContent = completedJobs || '0'
    }

    // 2. Count UPCOMING bookings (pending + future dates) for this site
    const today = new Date().toISOString().split('T')[0]
    console.log('[UI] Querying upcoming bookings for site_id:', siteId, 'with status="pending" and scheduled_date >=', today)
    const { count: upcomingBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'pending')
      .gte('scheduled_date', today)

    if (bookingsError) {
      console.error('[UI] ❌ Error counting upcoming bookings:', bookingsError)
      document.getElementById('site-detail-bookings').textContent = '0'
    } else {
      console.log('[UI] ✅ Upcoming Bookings for this site:', upcomingBookings)
      document.getElementById('site-detail-bookings').textContent = upcomingBookings || '0'
    }

  } catch (error) {
    console.error('[UI] Error calculating site metrics:', error)
    document.getElementById('site-detail-jobs').textContent = '0'
    document.getElementById('site-detail-bookings').textContent = '0'
  }
}

// Open site detail modal and populate with data
export async function openSiteDetailModal(siteId) {
  console.log('[UI] Opening modal for site ID:', siteId, 'Type:', typeof siteId)
  
  try {
    // Import supabase
    const { supabase } = await import('./supabase.js')
    
    // Try to get site from Supabase first
    let site = null
    
    console.log('[UI] Fetching site from Supabase...')
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .single()
    
    if (error) {
      console.warn('[UI] Supabase error:', error.message)
      console.log('[UI] Falling back to localStorage...')
      
      // Fallback to localStorage
      const sites = JSON.parse(localStorage.getItem('nfg_sites') || '[]')
      console.log('[UI] Sites in localStorage:', sites)
      site = sites.find(s => s.id == siteId)
    } else {
      site = data
      console.log('[UI] ✅ Site found in Supabase:', site)
    }
    
    if (!site) {
      console.error('[UI] ❌ Site not found! ID:', siteId)
      console.error('[UI] Available sites:', JSON.parse(localStorage.getItem('nfg_sites') || '[]'))
      toast.error(`Site not found (ID: ${siteId}). The site may have been deleted.`, 'Site Not Found')
      return
    }
    
    // Store current site ID for delete operation
    currentSiteId = siteId
    
    // Store current site data for edit operation (global variable in dashboard.html)
    window.currentEditSite = site;
    console.log('[UI] Stored current site for editing:', site.name);
    
    console.log('[UI] Populating modal with site data...')
    
    // Populate modal with site data
    document.getElementById('site-detail-name').textContent = site.name || 'Unknown Site'
    
    // Display address with copy button
    const addressContainer = document.getElementById('site-detail-address')
    if (site.address) {
      addressContainer.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="truncate">${site.address}</span>
          <button 
            onclick="copyAddress('${site.address.replace(/'/g, "\\'")}', event)" 
            class="text-gray-400 dark:text-gray-500 hover:text-nfgblue dark:hover:text-blue-400 transition p-0.5 rounded hover:bg-nfglight dark:hover:bg-gray-700 flex-shrink-0"
            title="Copy address">
            <i data-lucide="copy" class="w-3 h-3"></i>
          </button>
        </div>
      `
      if (window.lucide) lucide.createIcons()
    } else {
      addressContainer.textContent = 'No address'
    }
    document.getElementById('site-detail-status').textContent = site.status || 'Unknown'
    document.getElementById('site-detail-sqft').textContent = site.square_footage ? `${site.square_footage.toLocaleString()} sq ft` : '—'
    const dealValueEl = document.getElementById('site-detail-deal-value')
    if (dealValueEl) {
      dealValueEl.textContent = site.deal_value ? `$${Number(site.deal_value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
    }
    document.getElementById('site-detail-phone').textContent = site.contact_phone || '—'
    document.getElementById('site-detail-email').textContent = site.contact_email || '—'
    document.getElementById('site-detail-notes').textContent = site.notes || 'No notes available.'
    
    // Calculate and display REAL-TIME metrics
    console.log('[UI] 📊 Calculating real-time site metrics...')
    await calculateAndDisplaySiteMetrics(siteId)
    
    // Fetch and display recent activity (pending/in-progress jobs)
    console.log('[UI] 📋 Fetching recent activity...')
    await fetchAndDisplayRecentSiteActivity(siteId)
    
    // Hide Edit/Delete buttons for staff users
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      if (profile && profile.role === 'staff') {
        const editBtn = document.getElementById('edit-site-btn')
        const deleteBtn = document.getElementById('delete-site-btn')
        if (editBtn) editBtn.style.display = 'none'
        if (deleteBtn) deleteBtn.style.display = 'none'
        console.log('[UI] 🔒 Hidden Edit/Delete buttons for staff user')
      } else {
        const editBtn = document.getElementById('edit-site-btn')
        const deleteBtn = document.getElementById('delete-site-btn')
        if (editBtn) editBtn.style.display = ''
        if (deleteBtn) deleteBtn.style.display = ''
      }
    }
    
    // Show modal
    const modal = document.getElementById('siteDetailModal')
    if (modal) {
      console.log('[UI] ✅ Opening modal...')
      modal.classList.remove('hidden')
      modal.classList.add('flex')
      
      // Re-render Lucide icons
      if (window.lucide) {
        setTimeout(() => window.lucide.createIcons(), 50)
      }
    } else {
      console.error('[UI] ❌ Modal element not found!')
    }
  } catch (error) {
    console.error('[UI] Error opening site modal:', error)
    toast.error('Error opening site details. Check console for details.', 'Error')
  }
}

// Open delete confirmation modal
export function openDeleteConfirmModal() {
  if (!currentSiteId) {
    console.error('No site selected for deletion')
    return
  }
  
  // Get site data to show name in confirmation
  const sites = JSON.parse(localStorage.getItem('nfg_sites') || '[]')
  const site = sites.find(s => s.id == currentSiteId)
  
  if (site) {
    document.getElementById('delete-site-name').textContent = site.name
  }
  
  // Show confirmation modal
  const modal = document.getElementById('deleteSiteConfirmModal')
  if (modal) {
    modal.classList.remove('hidden')
    modal.classList.add('flex')
    
    // Re-render Lucide icons
    if (window.lucide) {
      setTimeout(() => window.lucide.createIcons(), 50)
    }
  }
}

// Delete site from Supabase (with CASCADE DELETE for related data)
export async function deleteSite() {
  if (!currentSiteId) {
    console.error('No site selected for deletion')
    return
  }
  
  try {
    // Import supabase
    const { supabase } = await import('./supabase.js')
    
    console.log('🗑️ Deleting site from Supabase:', currentSiteId)
    console.log('⚠️ This will automatically delete all related: jobs, bookings, assignments, inventory')
    
    // Delete site from Supabase - CASCADE DELETE will automatically handle:
    // - All jobs for this site
    // - All bookings for this site
    // - All worker assignments
    // - All inventory
    // - All inventory transactions
    const { error } = await supabase
      .from('sites')
      .delete()
      .eq('id', currentSiteId)
    
    if (error) {
      console.error('❌ Error deleting site:', error)
      throw error
    }
    
    console.log('✅ Site deleted successfully! All related data was automatically removed via CASCADE DELETE.')
    
    // Close both modals
    closeSiteDetailModal()
    closeDeleteConfirmModal()
    
    // Refresh the page to show updated sites
    // If there's a refresh function, call it; otherwise reload
    if (typeof window.fetchSites === 'function') {
      const sites = await window.fetchSites()
      renderSites(sites)
    } else if (typeof renderSitesFullPage === 'function') {
      const sites = await window.fetchSites?.() || []
      renderSitesFullPage(sites)
    } else {
      // Fallback: reload page
      window.location.reload()
    }
    
    toast.success('Site and all related data (jobs, bookings, inventory) deleted successfully!', 'Site Deleted')
    
    // Reset current site ID
    currentSiteId = null
    
  } catch (error) {
    console.error('❌ Error deleting site:', error)
    toast.error(`Failed to delete site: ${error.message}`, 'Delete Error')
  }
}

// Close site detail modal
export function closeSiteDetailModal() {
  const modal = document.getElementById('siteDetailModal')
  if (modal) {
    modal.classList.add('hidden')
    modal.classList.remove('flex')
  }
}

// Close delete confirmation modal
export function closeDeleteConfirmModal() {
  const modal = document.getElementById('deleteSiteConfirmModal')
  if (modal) {
    modal.classList.add('hidden')
    modal.classList.remove('flex')
  }
}

// Show loading state on submit button
export function setSubmitLoading(isLoading) {
  const btn = document.getElementById('submit-site-btn')
  if (!btn) return
  
  if (isLoading) {
    btn.disabled = true
    btn.innerHTML = `
      <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Creating...</span>
    `
  } else {
    btn.disabled = false
    btn.innerHTML = '<span>Create Site</span>'
  }
}

// Show error in modal
export function showFormError(message) {
  const errorEl = document.getElementById('form-error')
  if (errorEl) {
    errorEl.textContent = message
    errorEl.classList.remove('hidden')
  }
}

// Copy address to clipboard
window.copyAddress = async function(address, event) {
  event?.stopPropagation();
  event?.preventDefault();
  
  try {
    await navigator.clipboard.writeText(address);
    
    // Show success feedback
    const button = event?.target.closest('button');
    if (button) {
      const originalHTML = button.innerHTML;
      button.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i>';
      button.classList.add('text-green-600');
      if (window.lucide) lucide.createIcons();
      
      setTimeout(() => {
        button.innerHTML = originalHTML;
        button.classList.remove('text-green-600');
        if (window.lucide) lucide.createIcons();
      }, 1500);
    }
  } catch (err) {
    console.error('Failed to copy address:', err);
    toast.error('Failed to copy address', 'Copy Error');
  }
}

