// Analytics Dashboard UI Handler
// Manages the Sales Analytics tab and visualizations

import { 
  getFunnelMetrics,
  getTimeToCloseByVertical,
  getCallsPerClosedDeal,
  getStalledDeals,
  getDoorsKnockedPerHour,
  getAppointmentsPerHour,
  getConversionByTerritory,
  getBestTimeOfDay,
  formatNumber,
  formatPercent,
  formatCurrency,
  formatDateForAPI,
  getDefaultDateRange,
  getAccessibleFilters,
} from './analytics.js'
import { supabase } from './supabase.js'

let currentFilters = {}
let charts = {}

// Initialize analytics dashboard
document.addEventListener('DOMContentLoaded', async () => {
  // Wait for tab navigation to be set up
  setTimeout(async () => {
    await initializeAnalyticsFilters()
    setupAnalyticsEventListeners()
  }, 500)
})

async function initializeAnalyticsFilters() {
  try {
    const filters = await getAccessibleFilters()
    
    // Populate user filter
    const userSelect = document.getElementById('analytics-filter-user')
    if (userSelect) {
      userSelect.innerHTML = '<option value="">All Reps</option>'
      filters.users.forEach(user => {
        const option = document.createElement('option')
        option.value = user.id
        option.textContent = user.full_name || user.email || 'Unknown'
        if (user.id === filters.currentUserId) {
          option.selected = !filters.isManager && !filters.isAdmin
        }
        userSelect.appendChild(option)
      })
    }
    
    // Populate territory filter
    const territorySelect = document.getElementById('analytics-filter-territory')
    if (territorySelect) {
      territorySelect.innerHTML = '<option value="">All Territories</option>'
      filters.territories.forEach(territory => {
        const option = document.createElement('option')
        option.value = territory
        option.textContent = territory
        territorySelect.appendChild(option)
      })
    }
    
    // Populate vertical filter
    const verticalSelect = document.getElementById('analytics-filter-vertical')
    if (verticalSelect) {
      verticalSelect.innerHTML = '<option value="">All Verticals</option>'
      filters.verticals.forEach(vertical => {
        const option = document.createElement('option')
        option.value = vertical
        option.textContent = vertical
        verticalSelect.appendChild(option)
      })
    }
    
    // Populate source filter
    const sourceSelect = document.getElementById('analytics-filter-source')
    if (sourceSelect) {
      sourceSelect.innerHTML = '<option value="">All Sources</option>'
      filters.sources.forEach(source => {
        const option = document.createElement('option')
        option.value = source
        option.textContent = source
        sourceSelect.appendChild(option)
      })
    }
  } catch (error) {
    console.error('Error initializing analytics filters:', error)
  }
}

function setupAnalyticsEventListeners() {
  // Apply filters button
  const applyBtn = document.getElementById('analytics-apply-filters')
  if (applyBtn) {
    applyBtn.addEventListener('click', loadAnalyticsData)
  }
  
  // Stalled deals days filter
  const stalledDaysFilter = document.getElementById('stalled-days-filter')
  if (stalledDaysFilter) {
    stalledDaysFilter.addEventListener('change', () => loadStalledDeals())
  }
  
  // Best time activity type filter
  const bestTimeType = document.getElementById('best-time-activity-type')
  if (bestTimeType) {
    bestTimeType.addEventListener('change', () => loadBestTimeOfDay())
  }
  
  // Tab change listener
  const salesTab = document.getElementById('tab-sales-analytics')
  if (salesTab) {
    salesTab.addEventListener('click', () => {
      setTimeout(() => {
        loadAnalyticsData()
        initializeCharts()
      }, 100)
    })
  }
}

function getFilters() {
  const dateRange = getDefaultDateRange()
  return {
    start_date: dateRange.start_date,
    end_date: dateRange.end_date,
    user_id: document.getElementById('analytics-filter-user')?.value || null,
    territory: document.getElementById('analytics-filter-territory')?.value || null,
    vertical: document.getElementById('analytics-filter-vertical')?.value || null,
    source: document.getElementById('analytics-filter-source')?.value || null,
  }
}

async function loadAnalyticsData() {
  currentFilters = getFilters()
  
  try {
    // Load all analytics in parallel
    await Promise.all([
      loadFunnelMetrics(),
      loadTimeToClose(),
      loadCallsPerDeal(),
      loadStalledDeals(),
      loadDoorsPerHour(),
      loadAppointmentsPerHour(),
      loadConversionByTerritory(),
      loadBestTimeOfDay(),
    ])
  } catch (error) {
    console.error('Error loading analytics data:', error)
    showNotification('Error loading analytics data', 'error')
  }
}

async function loadFunnelMetrics() {
  try {
    const data = await getFunnelMetrics(currentFilters)
    
    // Update metric displays
    document.getElementById('funnel-calls').textContent = formatNumber(data.calls || 0)
    document.getElementById('funnel-connections').textContent = formatNumber(data.connections || 0)
    document.getElementById('funnel-quotes').textContent = formatNumber(data.quotes || 0)
    document.getElementById('funnel-wins').textContent = formatNumber(data.wins || 0)
    
    // Update conversion rates
    const rates = data.conversion_rates || {}
    document.getElementById('funnel-calls-to-connections').textContent = 
      formatPercent(rates.calls_to_connections || 0)
    document.getElementById('funnel-connections-to-quotes').textContent = 
      formatPercent(rates.connections_to_quotes || 0)
    document.getElementById('funnel-quotes-to-wins').textContent = 
      formatPercent(rates.quotes_to_wins || 0)
    
    // Update funnel chart
    updateFunnelChart(data)
  } catch (error) {
    console.error('Error loading funnel metrics:', error)
  }
}

function updateFunnelChart(data) {
  const ctx = document.getElementById('funnel-chart')?.getContext('2d')
  if (!ctx) return
  
  if (charts.funnel) charts.funnel.destroy()
  
  charts.funnel = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Calls', 'Connections', 'Quotes', 'Wins'],
      datasets: [{
        label: 'Count',
        data: [data.calls || 0, data.connections || 0, data.quotes || 0, data.wins || 0],
        backgroundColor: [
          'rgba(13, 71, 161, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(234, 179, 8, 0.8)',
          'rgba(168, 85, 247, 0.8)',
        ],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: { beginAtZero: true },
      },
    },
  })
}

async function loadTimeToClose() {
  try {
    const data = await getTimeToCloseByVertical(currentFilters)
    
    // Update table
    const tableBody = document.getElementById('time-to-close-table')
    if (tableBody && Array.isArray(data)) {
      tableBody.innerHTML = data.map(item => `
        <tr>
          <td class="py-2">${item.vertical || 'N/A'}</td>
          <td class="py-2 text-right">${Math.round(item.average_days || 0)} days</td>
          <td class="py-2 text-right">${Math.round(item.median_days || 0)} days</td>
          <td class="py-2 text-right">${formatNumber(item.deal_count || 0)}</td>
          <td class="py-2 text-right">${formatCurrency(item.total_value || 0)}</td>
        </tr>
      `).join('') || '<tr><td colspan="5" class="py-4 text-center text-gray-500">No data</td></tr>'
    }
    
    // Update chart
    updateTimeToCloseChart(data)
  } catch (error) {
    console.error('Error loading time to close:', error)
  }
}

function updateTimeToCloseChart(data) {
  const ctx = document.getElementById('time-to-close-chart')?.getContext('2d')
  if (!ctx || !Array.isArray(data)) return
  
  if (charts.timeToClose) charts.timeToClose.destroy()
  
  charts.timeToClose = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.vertical || 'N/A'),
      datasets: [{
        label: 'Average Days to Close',
        data: data.map(d => Math.round(d.average_days || 0)),
        backgroundColor: 'rgba(13, 71, 161, 0.8)',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true },
      },
    },
  })
}

async function loadCallsPerDeal() {
  try {
    const data = await getCallsPerClosedDeal(currentFilters)
    
    // Update summary cards
    document.getElementById('calls-per-deal-avg').textContent = 
      formatNumber(data.average_calls_per_deal || 0, 1)
    document.getElementById('calls-per-deal-total-calls').textContent = 
      formatNumber(data.total_calls || 0)
    document.getElementById('calls-per-deal-total-deals').textContent = 
      formatNumber(data.total_deals || 0)
    
    // Update chart
    if (Array.isArray(data.by_user)) {
      updateCallsPerDealChart(data.by_user)
    }
  } catch (error) {
    console.error('Error loading calls per deal:', error)
  }
}

function updateCallsPerDealChart(users) {
  const ctx = document.getElementById('calls-per-deal-chart')?.getContext('2d')
  if (!ctx) return
  
  if (charts.callsPerDeal) charts.callsPerDeal.destroy()
  
  charts.callsPerDeal = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: users.map(u => u.user_name || 'Unknown'),
      datasets: [{
        label: 'Calls per Deal',
        data: users.map(u => Number(u.calls_per_deal || 0).toFixed(1)),
        backgroundColor: 'rgba(13, 71, 161, 0.8)',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true },
      },
    },
  })
}

async function loadStalledDeals() {
  try {
    const days = parseInt(document.getElementById('stalled-days-filter')?.value || 14)
    const data = await getStalledDeals({
      ...currentFilters,
      days_without_touch: days,
    })
    
    // Update table
    const tableBody = document.getElementById('stalled-deals-table')
    if (tableBody && Array.isArray(data)) {
      tableBody.innerHTML = data.map(deal => `
        <tr class="hover:bg-nfglight dark:hover:bg-gray-700">
          <td class="py-2">${deal.site_name || 'N/A'}</td>
          <td class="py-2">${deal.assigned_user_name || 'Unassigned'}</td>
          <td class="py-2">${formatCurrency(deal.last_quote_value || 0)}</td>
          <td class="py-2 text-right">${Math.round(deal.days_since_touch || 0)}</td>
          <td class="py-2">${deal.territory || 'N/A'}</td>
          <td class="py-2">${deal.vertical || 'N/A'}</td>
        </tr>
      `).join('') || '<tr><td colspan="6" class="py-4 text-center text-gray-500">No stalled deals</td></tr>'
    }
  } catch (error) {
    console.error('Error loading stalled deals:', error)
  }
}

async function loadDoorsPerHour() {
  try {
    const data = await getDoorsKnockedPerHour(currentFilters)
    
    // Update average
    document.getElementById('doors-per-hour-avg').textContent = 
      formatNumber(data.overall_average || 0, 1)
    
    // Update chart
    if (Array.isArray(data.by_user)) {
      updateDoorsPerHourChart(data.by_user)
    }
  } catch (error) {
    console.error('Error loading doors per hour:', error)
  }
}

function updateDoorsPerHourChart(users) {
  const ctx = document.getElementById('doors-per-hour-chart')?.getContext('2d')
  if (!ctx) return
  
  if (charts.doorsPerHour) charts.doorsPerHour.destroy()
  
  charts.doorsPerHour = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: users.map(u => u.user_name || 'Unknown'),
      datasets: [{
        label: 'Knocks per Hour',
        data: users.map(u => Number(u.knocks_per_hour || 0).toFixed(1)),
        backgroundColor: 'rgba(13, 71, 161, 0.8)',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true },
      },
    },
  })
}

async function loadAppointmentsPerHour() {
  try {
    const data = await getAppointmentsPerHour(currentFilters)
    
    // Update average
    document.getElementById('appointments-per-hour-avg').textContent = 
      formatNumber(data.overall_average || 0, 1)
    
    // Update chart
    if (Array.isArray(data.by_user)) {
      updateAppointmentsPerHourChart(data.by_user)
    }
  } catch (error) {
    console.error('Error loading appointments per hour:', error)
  }
}

function updateAppointmentsPerHourChart(users) {
  const ctx = document.getElementById('appointments-per-hour-chart')?.getContext('2d')
  if (!ctx) return
  
  if (charts.appointmentsPerHour) charts.appointmentsPerHour.destroy()
  
  charts.appointmentsPerHour = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: users.map(u => u.user_name || 'Unknown'),
      datasets: [{
        label: 'Appointments per Hour',
        data: users.map(u => Number(u.appointments_per_hour || 0).toFixed(1)),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true },
      },
    },
  })
}

async function loadConversionByTerritory() {
  try {
    const data = await getConversionByTerritory(currentFilters)
    
    // Update table
    const tableBody = document.getElementById('conversion-territory-table')
    if (tableBody && Array.isArray(data)) {
      tableBody.innerHTML = data.map(territory => `
        <tr class="hover:bg-nfglight dark:hover:bg-gray-700">
          <td class="py-2">${territory.territory || 'N/A'}</td>
          <td class="py-2 text-right">${formatNumber(territory.door_knocks || 0)}</td>
          <td class="py-2 text-right">${formatNumber(territory.appointments || 0)}</td>
          <td class="py-2 text-right">${formatNumber(territory.quotes || 0)}</td>
          <td class="py-2 text-right">${formatNumber(territory.wins || 0)}</td>
          <td class="py-2 text-right">${formatPercent(territory.knock_to_appointment_rate || 0)}</td>
          <td class="py-2 text-right">${formatPercent(territory.quote_to_win_rate || 0)}</td>
        </tr>
      `).join('') || '<tr><td colspan="7" class="py-4 text-center text-gray-500">No data</td></tr>'
    }
    
    // Update chart
    updateConversionTerritoryChart(data)
  } catch (error) {
    console.error('Error loading conversion by territory:', error)
  }
}

function updateConversionTerritoryChart(data) {
  const ctx = document.getElementById('conversion-territory-chart')?.getContext('2d')
  if (!ctx || !Array.isArray(data)) return
  
  if (charts.conversionTerritory) charts.conversionTerritory.destroy()
  
  charts.conversionTerritory = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.territory || 'N/A'),
      datasets: [
        {
          label: 'Door Knocks',
          data: data.map(d => d.door_knocks || 0),
          backgroundColor: 'rgba(13, 71, 161, 0.8)',
        },
        {
          label: 'Appointments',
          data: data.map(d => d.appointments || 0),
          backgroundColor: 'rgba(34, 197, 94, 0.8)',
        },
        {
          label: 'Quotes',
          data: data.map(d => d.quotes || 0),
          backgroundColor: 'rgba(234, 179, 8, 0.8)',
        },
        {
          label: 'Wins',
          data: data.map(d => d.wins || 0),
          backgroundColor: 'rgba(168, 85, 247, 0.8)',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true },
      },
    },
  })
}

async function loadBestTimeOfDay() {
  try {
    const activityType = document.getElementById('best-time-activity-type')?.value || 'door_knock'
    const data = await getBestTimeOfDay({
      ...currentFilters,
      activity_type: activityType,
    })
    
    // Update chart
    updateBestTimeChart(data, activityType)
  } catch (error) {
    console.error('Error loading best time of day:', error)
  }
}

function updateBestTimeChart(data, activityType) {
  const ctx = document.getElementById('best-time-chart')?.getContext('2d')
  if (!ctx || !Array.isArray(data)) return
  
  if (charts.bestTime) charts.bestTime.destroy()
  
  const rateField = activityType === 'door_knock' ? 'conversion_rate' : 
                    activityType === 'appointment' ? 'completion_rate' : 'answer_rate'
  
  charts.bestTime = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.hour_label || ''),
      datasets: [
        {
          label: 'Activity Count',
          data: data.map(d => d.activity_count || 0),
          borderColor: 'rgba(13, 71, 161, 1)',
          backgroundColor: 'rgba(13, 71, 161, 0.1)',
          yAxisID: 'y',
        },
        {
          label: activityType === 'door_knock' ? 'Conversion Rate' :
                 activityType === 'appointment' ? 'Completion Rate' : 'Answer Rate',
          data: data.map(d => d[rateField] || 0),
          borderColor: 'rgba(34, 197, 94, 1)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
        },
        y1: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          max: 100,
        },
      },
    },
  })
}

function initializeCharts() {
  // Charts will be initialized when data is loaded
  // This is called when the tab is clicked
}

function showNotification(message, type = 'info') {
  // Simple notification - you can integrate with your notification system
  console.log(`[${type.toUpperCase()}] ${message}`)
}
