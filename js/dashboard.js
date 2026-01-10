import { supabase } from './supabase.js'
import { renderSites, initializeUI, closeAddSiteModal, setSubmitLoading, showFormError } from './ui.js'

let currentUser = null;
let currentUserProfile = null;

// Get current user and their profile
async function getCurrentUser() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Not authenticated');
    
    currentUser = user;
    
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }
    
    currentUserProfile = profile;
    console.log('Dashboard - Current user profile:', currentUserProfile);
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Logout functionality
async function handleLogout() {
  await supabase.auth.signOut()
  window.location.href = './index.html'
}

// Calculate metrics for each site
async function calculateSiteMetrics(sites) {
  if (!sites || sites.length === 0) return sites;
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get all site IDs
    const siteIds = sites.map(s => s.id);
    
    // Fetch upcoming bookings count for each site
    const { data: bookingCounts, error: bookingsError } = await supabase
      .from('bookings')
      .select('site_id')
      .eq('status', 'pending')
      .gte('scheduled_date', today)
      .in('site_id', siteIds);
    
    if (bookingsError) {
      console.error('Error fetching booking counts:', bookingsError);
    }
    
    // Fetch completed jobs count for each site
    const { data: jobCounts, error: jobsError } = await supabase
      .from('jobs')
      .select('site_id')
      .eq('status', 'completed')
      .in('site_id', siteIds);
    
    if (jobsError) {
      console.error('Error fetching job counts:', jobsError);
    }
    
    // Create maps for counts
    const upcomingBookingsMap = {};
    const completedJobsMap = {};
    
    // Count bookings per site
    if (bookingCounts) {
      bookingCounts.forEach(booking => {
        upcomingBookingsMap[booking.site_id] = (upcomingBookingsMap[booking.site_id] || 0) + 1;
      });
    }
    
    // Count jobs per site
    if (jobCounts) {
      jobCounts.forEach(job => {
        completedJobsMap[job.site_id] = (completedJobsMap[job.site_id] || 0) + 1;
      });
    }
    
    // Attach metrics to each site
    return sites.map(site => ({
      ...site,
      upcoming_bookings: upcomingBookingsMap[site.id] || 0,
      jobs_completed: completedJobsMap[site.id] || 0
    }));
  } catch (error) {
    console.error('Error calculating site metrics:', error);
    return sites;
  }
}

// Fetch and display sites
async function fetchSites() {
  try {
    // Ensure we have current user info
    if (!currentUser) {
      await getCurrentUser();
    }

    let sites = [];

    if (currentUserProfile && currentUserProfile.role === 'staff') {
      console.log('🔍 Dashboard - Fetching sites for staff user:', currentUser.id);
      
      // For staff, fetch assigned sites
      const { data: assignments, error: assignError } = await supabase
        .from('worker_site_assignments')
        .select('site_id')
        .eq('worker_id', currentUser.id);
      
      console.log('📋 Dashboard - Assignments found:', assignments);
      if (assignError) {
        console.error('❌ Dashboard - Error fetching assignments:', assignError);
        return [];
      }
      if (!assignments || assignments.length === 0) {
        console.warn('⚠️ Dashboard - No site assignments found for this staff member');
        return [];
      }
      
      const siteIds = assignments.map(a => a.site_id);
      console.log('🏢 Dashboard - Fetching sites with IDs:', siteIds);
      
      const { data: fetchedSites, error } = await supabase
        .from('sites')
        .select('*')
        .in('id', siteIds)
        .order('name', { ascending: true });
      
      console.log('✅ Dashboard - Sites fetched:', fetchedSites);
      if (error) {
        console.error('❌ Dashboard - Error fetching sites:', error);
        return [];
      }
      sites = fetchedSites || [];
    } else {
      // Admin/Client - fetch ONLY their sites from Supabase
      console.log('🔍 Dashboard - Fetching sites for user:', currentUser.id);
      const { data: fetchedSites, error } = await supabase
        .from('sites')
        .select('*')
        .eq('created_by', currentUser.id)  // CRITICAL: Only fetch sites created by this user!
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Dashboard - Error fetching sites from Supabase:', error);
        return [];
      }
      
      console.log('Dashboard - Sites fetched for user:', fetchedSites);
      sites = fetchedSites || [];
    }
    
    // Calculate metrics for all sites
    const sitesWithMetrics = await calculateSiteMetrics(sites);
    console.log('Dashboard - Sites with metrics:', sitesWithMetrics);
    
    return sitesWithMetrics;
  } catch (error) {
    console.error('Error fetching sites:', error)
    return []
  }
}

// Create new site
async function createSite(siteData) {
  try {
    console.log('Creating site in Supabase:', siteData);
    const { data: newSite, error } = await supabase
      .from('sites')
      .insert({
        name: siteData.name,
        address: siteData.address,
        status: siteData.status,
        square_footage: siteData.square_footage,
        contact_phone: siteData.contact_phone,
        contact_email: siteData.contact_email,
        notes: siteData.notes,
        created_by: currentUser.id  // CRITICAL: Set the owner!
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating site in Supabase:', error);
      throw error;
    }
    
    console.log('✅ Site created in Supabase:', newSite);
    return newSite;
  } catch (error) {
    console.error('Error creating site:', error)
    throw error
  }
}

// Handle site form submission
async function handleSiteFormSubmit(e) {
  e.preventDefault()
  
  const form = e.target
  const formData = new FormData(form)
  
  const siteData = {
    name: formData.get('name'),
    address: formData.get('address'),
    status: formData.get('status'),
    square_footage: formData.get('square_footage') ? parseInt(formData.get('square_footage')) : null,
    contact_phone: formData.get('contact_phone') || null,
    contact_email: formData.get('contact_email') || null,
    notes: formData.get('notes') || null
  }
  
  setSubmitLoading(true)
  
  try {
    await createSite(siteData)
    
    // Refresh the sites list
    const sites = await fetchSites()
    renderSites(sites)
    
    // Also refresh full sites page if it exists
    if (typeof renderSitesFullPage === 'function') {
      renderSitesFullPage(sites)
    }
    
    // Close modal and show success
    closeAddSiteModal()
    
    // Optional: Show success message
    console.log('Site created successfully!')
    
  } catch (error) {
    showFormError(error.message || 'Failed to create site. Please try again.')
  } finally {
    setSubmitLoading(false)
  }
}

// Fetch and display recent jobs
async function fetchRecentJobs() {
  try {
    console.log('📋 Fetching recent jobs for user:', currentUser.id);
    
    // Fetch jobs created by this user
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select(`
        id, 
        title, 
        status, 
        job_type, 
        scheduled_date,
        site_id,
        created_at
      `)
      .eq('created_by', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('❌ Error fetching recent jobs:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Show error in UI
      const jobsList = document.getElementById('jobs-list');
      if (jobsList) {
        jobsList.innerHTML = `
          <div class="py-6 text-center text-red-500">
            <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-2"></i>
            <p class="font-medium">Error loading jobs</p>
            <p class="text-sm text-gray-500 mt-1">${error.message || 'Database query failed'}</p>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
      }
      return;
    }
    
    console.log('📋 Jobs fetched:', jobs);
    
    const jobsList = document.getElementById('jobs-list');
    if (!jobsList) {
      console.error('❌ jobs-list element not found!');
      return;
    }
    
    console.log('📋 Rendering jobs to DOM...');
    
    if (!jobs || jobs.length === 0) {
      console.log('📋 No jobs found, showing empty state');
      jobsList.innerHTML = `
        <div class="py-6 text-center text-gray-500 dark:text-gray-400">
          <i data-lucide="clipboard" class="w-12 h-12 mx-auto mb-2 text-gray-300"></i>
          <p>No jobs yet</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }
    
    // Fetch site names for all jobs
    const siteIds = [...new Set(jobs.map(j => j.site_id).filter(Boolean))];
    const { data: sites } = await supabase
      .from('sites')
      .select('id, name')
      .in('id', siteIds);
    
    const siteMap = {};
    if (sites) {
      sites.forEach(site => {
        siteMap[site.id] = site.name;
      });
    }
    
    jobsList.innerHTML = jobs.map(job => {
      const siteName = siteMap[job.site_id] || 'Unknown site';
      const statusColors = {
        'pending': 'text-yellow-600',
        'in-progress': 'text-blue-600',
        'completed': 'text-green-600',
        'cancelled': 'text-red-600'
      };
      
      const statusIcons = {
        'pending': 'clock',
        'in-progress': 'play-circle',
        'completed': 'check-circle',
        'cancelled': 'x-circle'
      };
      
      const typeIcons = {
        'cleaning': 'sparkles',
        'maintenance': 'wrench',
        'repair': 'tool',
        'inspection': 'search',
        'emergency': 'alert-circle'
      };
      
      const statusColor = statusColors[job.status] || 'text-gray-600';
      const statusIcon = statusIcons[job.status] || 'circle';
      const typeIcon = typeIcons[job.job_type] || 'clipboard-check';
      const isEmergency = job.job_type === 'emergency';
      
      return `
        <div class="py-3 flex justify-between items-center hover:bg-nfglight/50 transition rounded-lg px-2 cursor-pointer" 
             onclick="window.location.href='jobs.html?job=${job.id}'">
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1.5">
              <i data-lucide="${typeIcon}" class="w-4 h-4 ${isEmergency ? 'text-red-600' : 'text-nfgblue'}"></i>
              ${isEmergency ? '<span class="text-xs font-bold text-red-600">!</span>' : ''}
            </div>
            <div>
              <p class="font-medium text-sm ${isEmergency ? 'text-red-600' : 'text-nfgblue'}">${job.title}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">${siteName}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <i data-lucide="${statusIcon}" class="w-4 h-4 ${statusColor}"></i>
            <span class="text-sm ${statusColor} capitalize">${job.status.replace('-', ' ')}</span>
          </div>
        </div>
      `;
    }).join('');
    
    if (window.lucide) lucide.createIcons();
    console.log('📋 Recent Jobs loaded:', jobs.length);
  } catch (error) {
    console.error('Error fetching recent jobs:', error);
  }
}

// Fetch and display inventory summary
async function fetchInventorySummary() {
  try {
    console.log('📦 Fetching inventory summary...');
    
    // Fetch inventory categories with low stock counts
    const { data: summary, error } = await supabase
      .rpc('get_low_stock_by_category');
    
    if (error) {
      console.warn('⚠️ Error fetching inventory summary:', error);
      console.log('💡 This is expected if inventory tables don\'t exist yet');
      
      // Show friendly message
      const inventoryList = document.getElementById('inventory-summary');
      if (inventoryList) {
        inventoryList.innerHTML = `
          <div class="py-6 text-center text-gray-500 dark:text-gray-400">
            <i data-lucide="package" class="w-12 h-12 mx-auto mb-2 text-gray-300"></i>
            <p class="font-medium">Inventory System Not Set Up</p>
            <p class="text-sm mt-1">Run SETUP_INVENTORY_SYSTEM.sql in your database</p>
            <button onclick="window.location.href='inventory.html'" class="mt-3 px-4 py-2 rounded-xl bg-nfgblue text-white hover:bg-nfgdark text-sm">
              Go to Inventory
            </button>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
      }
      return;
    }
    
    console.log('📦 Inventory summary fetched:', summary);
    
    const inventoryList = document.getElementById('inventory-summary');
    if (!inventoryList) {
      console.error('❌ inventory-summary element not found!');
      return;
    }
    
    console.log('📦 Rendering inventory summary to DOM...');
    
    if (!summary || summary.length === 0) {
      console.log('📦 No inventory categories found, showing empty state');
      inventoryList.innerHTML = `
        <div class="py-6 text-center text-gray-500 dark:text-gray-400">
          <i data-lucide="package" class="w-12 h-12 mx-auto mb-2 text-gray-300"></i>
          <p>No inventory items yet</p>
          <button onclick="window.location.href='inventory.html'" class="mt-3 px-4 py-2 rounded-xl bg-nfgblue text-white hover:bg-nfgdark text-sm">
            Add First Item
          </button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }
    
    // Map category icons
    const categoryIcons = {
      'Cleaning Supplies': 'sparkles',
      'Chemicals': 'droplet',
      'Tools': 'wrench',
      'Paper Products': 'file-text',
      'PPE': 'shield',
      'Trash Bags': 'trash-2',
      'Other': 'package'
    };
    
    inventoryList.innerHTML = summary.map(cat => {
      const icon = categoryIcons[cat.category_name] || 'package';
      const totalItems = parseInt(cat.total_items) || 0;
      const lowCount = parseInt(cat.low_count) || 0;
      
      let statusHTML = '';
      if (lowCount === 0) {
        statusHTML = '<span class="text-green-600 font-medium">OK</span>';
      } else if (lowCount >= 3) {
        statusHTML = `<span class="text-red-600 font-medium">${lowCount} low</span>`;
      } else {
        statusHTML = `<span class="text-orange-600 font-medium">${lowCount} low</span>`;
      }
      
      return `
        <div class="py-2 flex justify-between items-center hover:bg-nfglight/50 transition rounded-lg px-2 cursor-pointer" 
             onclick="window.location.href='inventory.html'">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <i data-lucide="${icon}" class="w-5 h-5 text-nfgblue"></i>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-sm text-nfgblue truncate">${cat.category_name}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">${totalItems} items</p>
            </div>
          </div>
          <div class="flex-shrink-0">
            ${statusHTML}
          </div>
        </div>
      `;
    }).join('');
    
    if (window.lucide) lucide.createIcons();
    console.log('📦 Inventory Summary loaded:', summary.length, 'categories');
  } catch (error) {
    console.error('Error fetching inventory summary:', error);
  }
}

// Fetch and display recurring jobs
async function fetchRecurringJobs() {
  try {
    console.log('🔄 Fetching recurring jobs for user:', currentUser.id);
    
    // Fetch recurring jobs created by this user
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select(`
        id, 
        title, 
        status, 
        job_type, 
        scheduled_date,
        site_id,
        frequency
      `)
      .eq('created_by', currentUser.id)
      .eq('frequency', 'recurring')
      .order('scheduled_date', { ascending: true })
      .limit(5);
    
    if (error) {
      console.error('❌ Error fetching recurring jobs:', error);
      
      const recurringJobsList = document.getElementById('recurring-jobs-list');
      if (recurringJobsList) {
        recurringJobsList.innerHTML = `
          <div class="py-6 text-center text-red-500">
            <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-2"></i>
            <p class="font-medium">Error loading recurring jobs</p>
            <p class="text-sm text-gray-500 mt-1">${error.message || 'Database query failed'}</p>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
      }
      return;
    }
    
    console.log('🔄 Recurring jobs fetched:', jobs);
    
    const recurringJobsList = document.getElementById('recurring-jobs-list');
    if (!recurringJobsList) {
      console.error('❌ recurring-jobs-list element not found!');
      return;
    }
    
    if (!jobs || jobs.length === 0) {
      recurringJobsList.innerHTML = `
        <div class="py-6 text-center text-gray-500 dark:text-gray-400">
          <i data-lucide="repeat" class="w-12 h-12 mx-auto mb-2 text-gray-300"></i>
          <p>No recurring jobs</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }
    
    // Fetch site names for all jobs
    const siteIds = [...new Set(jobs.map(j => j.site_id).filter(Boolean))];
    const { data: sites } = await supabase
      .from('sites')
      .select('id, name')
      .in('id', siteIds);
    
    const siteMap = {};
    if (sites) {
      sites.forEach(site => {
        siteMap[site.id] = site.name;
      });
    }
    
    recurringJobsList.innerHTML = jobs.map(job => {
      const siteName = siteMap[job.site_id] || 'Unknown site';
      const statusColors = {
        'pending': 'text-yellow-600',
        'in-progress': 'text-blue-600',
        'completed': 'text-green-600',
        'cancelled': 'text-red-600'
      };
      
      const statusIcons = {
        'pending': 'clock',
        'in-progress': 'play-circle',
        'completed': 'check-circle',
        'cancelled': 'x-circle'
      };
      
      const statusColor = statusColors[job.status] || 'text-gray-600';
      const statusIcon = statusIcons[job.status] || 'circle';
      
      return `
        <div class="py-3 flex justify-between items-center hover:bg-nfglight/50 transition rounded-lg px-2 cursor-pointer" 
             onclick="window.location.href='jobs.html?job=${job.id}'">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <i data-lucide="repeat" class="w-4 h-4 text-nfgblue flex-shrink-0"></i>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-sm text-nfgblue truncate">${job.title}</p>
              <p class="text-xs text-gray-500 truncate">${siteName}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <i data-lucide="${statusIcon}" class="w-4 h-4 ${statusColor}"></i>
          </div>
        </div>
      `;
    }).join('');
    
    if (window.lucide) lucide.createIcons();
    console.log('🔄 Recurring Jobs loaded:', jobs.length);
  } catch (error) {
    console.error('Error fetching recurring jobs:', error);
  }
}

// Fetch and display dashboard statistics
async function fetchDashboardStats() {
  try {
    // Fetch active jobs (pending + in-progress) count
    // Use separate queries to avoid complex OR syntax issues
    let activeJobsCount = 0;
    try {
      const { count: pendingCount } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      const { count: inProgressCount } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'in-progress');
      
      activeJobsCount = (pendingCount || 0) + (inProgressCount || 0);
    } catch (jobsError) {
      console.error('Error fetching active jobs:', jobsError);
    
    const activeJobsEl = document.getElementById('stat-active-jobs');
    if (activeJobsEl) {
      activeJobsEl.textContent = activeJobsCount || 0;
    }
    console.log('📊 Active Jobs:', activeJobsCount);

    // Fetch upcoming bookings count
    const today = new Date().toISOString().split('T')[0];
    const { count: upcomingCount, error: bookingsError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .gte('scheduled_date', today);
    
    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
    }
    
    const upcomingEl = document.getElementById('stat-upcoming');
    if (upcomingEl) {
      upcomingEl.textContent = upcomingCount || 0;
    }

    // Fetch emergency requests count
    let emergenciesCount = 0;
    try {
      const { count: emergPending } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('job_type', 'emergency')
        .eq('status', 'pending');
      
      const { count: emergInProgress } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('job_type', 'emergency')
        .eq('status', 'in-progress');
      
      emergenciesCount = (emergPending || 0) + (emergInProgress || 0);
    } catch (emergError) {
      console.error('Error fetching emergencies:', emergError);
    }
    
    const emergenciesEl = document.getElementById('stat-emergencies');
    if (emergenciesEl) {
      emergenciesEl.textContent = emergenciesCount || 0;
    }
    console.log('🚨 Emergency Requests:', emergenciesCount);

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
  }
}


// Initialize dashboard
async function initDashboard() {
  // Get current user first
  await getCurrentUser();
  
  const sites = await fetchSites()
  renderSites(sites)
  initializeUI()
  
  // Fetch and display dashboard statistics
  await fetchDashboardStats()
  
  // Fetch and display recent jobs
  await fetchRecentJobs()
  
  // Fetch and display recurring jobs
  await fetchRecurringJobs()
  
  // Fetch and display upcoming bookings
  await fetchInventorySummary()
  
  // Attach form submit handler
  const form = document.getElementById('add-site-form')
  form?.addEventListener('submit', handleSiteFormSubmit)
  
  // Attach logout handler
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout)
}

// Load dashboard on page load
initDashboard()

