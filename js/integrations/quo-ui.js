// ============================================
// Quo Integration UI Components
// ============================================
// UI utilities for displaying calls and click-to-call
// ============================================

import { supabase } from '../supabase.js'
import { 
  initiateClickToCall, 
  formatPhoneNumber,
  getCallsForSite,
  manuallyLinkCall 
} from './quo.js'

// ============================================
// Render Call Timeline Item
// ============================================

export function renderCallTimelineItem(call) {
  const directionIcon = call.direction === 'inbound' ? '📞' : '📱'
  const outcomeIcon = {
    'answered': '✅',
    'missed': '❌',
    'voicemail': '📧',
    'busy': '🔴',
    'failed': '⚠️',
    'no_answer': '⏰',
    'cancelled': '🚫'
  }[call.outcome] || '📞'
  
  const duration = call.duration_seconds 
    ? `${Math.floor(call.duration_seconds / 60)}:${String(call.duration_seconds % 60).padStart(2, '0')}`
    : 'N/A'
  
  const formattedDate = call.started_at 
    ? new Date(call.started_at).toLocaleString()
    : 'Unknown'
  
  const needsReviewBadge = call.needs_review 
    ? '<span class="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Needs Review</span>'
    : ''
  
  return `
    <div class="call-timeline-item p-4 border border-gray-200 rounded-lg mb-3" data-call-id="${call.id}">
      <div class="flex items-start justify-between">
        <div class="flex items-start gap-3">
          <div class="text-2xl">${directionIcon} ${outcomeIcon}</div>
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-semibold">${call.direction === 'inbound' ? 'Inbound' : 'Outbound'} Call</span>
              ${needsReviewBadge}
            </div>
            <div class="text-sm text-gray-600 mb-2">
              <div>From: ${formatPhoneNumber(call.from_number_raw || call.from_number)}</div>
              <div>To: ${formatPhoneNumber(call.to_number_raw || call.to_number)}</div>
              <div>Duration: ${duration}</div>
              <div>${formattedDate}</div>
            </div>
            ${call.summary ? `<div class="text-sm mt-2 p-2 bg-gray-50 rounded">${call.summary}</div>` : ''}
            ${call.objection_tags && call.objection_tags.length > 0 
              ? `<div class="flex gap-1 mt-2 flex-wrap">
                  ${call.objection_tags.map(tag => 
                    `<span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">${tag}</span>`
                  ).join('')}
                </div>`
              : ''}
            ${call.next_action_suggested 
              ? `<div class="mt-2 text-sm">
                  <strong>Next Action:</strong> ${call.next_action_suggested}
                  ${!call.next_action_created 
                    ? `<button class="ml-2 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700" 
                         onclick="createNextActionTask('${call.id}', '${call.next_action_suggested.replace(/'/g, "\\'")}')">
                        Create Task
                      </button>`
                    : '<span class="ml-2 text-xs text-green-600">✓ Task Created</span>'
                  }
                </div>`
              : ''}
          </div>
        </div>
        <div class="flex gap-2">
          ${call.recording_url && call.has_consent 
            ? `<a href="${call.recording_url}" target="_blank" 
                 class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                 Listen
               </a>`
            : ''}
          ${call.needs_review 
            ? `<button onclick="reviewCallLink('${call.id}')" 
                 class="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700">
                 Review
               </button>`
            : ''}
        </div>
      </div>
    </div>
  `
}

// ============================================
// Render Calls Timeline for Site
// ============================================

export async function renderCallsTimeline(siteId, containerId = 'calls-timeline') {
  const container = document.getElementById(containerId)
  if (!container) {
    console.error('Calls timeline container not found:', containerId)
    return
  }
  
  container.innerHTML = '<div class="text-center py-4">Loading calls...</div>'
  
  try {
    const calls = await getCallsForSite(siteId, { limit: 20 })
    
    if (calls.length === 0) {
      container.innerHTML = '<div class="text-center py-8 text-gray-500">No calls recorded yet</div>'
      return
    }
    
    container.innerHTML = calls.map(call => renderCallTimelineItem(call)).join('')
  } catch (error) {
    console.error('Error loading calls:', error)
    container.innerHTML = '<div class="text-center py-4 text-red-600">Error loading calls</div>'
  }
}

// ============================================
// Click-to-Call Button Component
// ============================================

export function createClickToCallButton(phoneNumber, options = {}) {
  const { siteId, siteName, buttonText = 'Call', className = '' } = options
  
  const button = document.createElement('button')
  button.className = `px-4 py-2 rounded-xl bg-nfgblue text-white hover:bg-nfgdark flex items-center gap-2 ${className}`
  button.innerHTML = `
    <i data-lucide="phone" class="w-4 h-4"></i>
    <span>${buttonText}</span>
  `
  
  button.addEventListener('click', async () => {
    const result = await initiateClickToCall(phoneNumber, { siteId, siteName })
    if (!result.success) {
      alert('Error initiating call: ' + (result.error || 'Unknown error'))
    }
  })
  
  // Initialize Lucide icons if available
  if (window.lucide) {
    window.lucide.createIcons()
  }
  
  return button
}

// ============================================
// Call Review Modal
// ============================================

export async function showCallReviewModal(callId) {
  // Fetch call details
  const { data: call, error } = await supabase
    .from('calls')
    .select('*, sites(id, name, contact_phone)')
    .eq('id', callId)
    .single()
  
  if (error || !call) {
    alert('Error loading call details')
    return
  }
  
  // Find potential matches
  const { data: potentialSites } = await supabase
    .from('sites')
    .select('id, name, contact_phone, status')
    .or(`contact_phone.eq.${call.from_number},contact_phone.eq.${call.to_number}`)
    .limit(10)
  
  // Create modal HTML
  const modalHTML = `
    <div id="call-review-modal" class="fixed inset-0 bg-black/40 items-center justify-center p-4 z-[60] flex">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="p-4 border-b border-gray-200 flex items-center justify-between">
          <h4 class="text-lg font-semibold">Review Call Link</h4>
          <button onclick="closeCallReviewModal()" class="p-1 rounded-lg hover:bg-gray-100">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div class="p-4 space-y-4">
          <div>
            <strong>Call Details:</strong>
            <div class="text-sm text-gray-600 mt-1">
              From: ${formatPhoneNumber(call.from_number_raw || call.from_number)}<br>
              To: ${formatPhoneNumber(call.to_number_raw || call.to_number)}<br>
              Date: ${new Date(call.started_at).toLocaleString()}<br>
              Outcome: ${call.outcome}
            </div>
          </div>
          
          <div>
            <strong>Current Link:</strong>
            <div class="text-sm text-gray-600 mt-1">
              ${call.sites?.name || 'Not linked'}
            </div>
          </div>
          
          <div>
            <strong>Potential Matches:</strong>
            <div class="mt-2 space-y-2">
              ${potentialSites?.map(site => `
                <div class="p-3 border border-gray-200 rounded-lg flex items-center justify-between">
                  <div>
                    <div class="font-medium">${site.name}</div>
                    <div class="text-sm text-gray-600">${site.contact_phone}</div>
                  </div>
                  <button onclick="linkCallToSite('${callId}', ${site.id})" 
                          class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Link
                  </button>
                </div>
              `).join('') || '<div class="text-sm text-gray-500">No matches found</div>'}
            </div>
          </div>
        </div>
        <div class="p-4 border-t border-gray-200 flex justify-end">
          <button onclick="closeCallReviewModal()" class="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  `
  
  // Add modal to page
  document.body.insertAdjacentHTML('beforeend', modalHTML)
  
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons()
  }
}

// Global functions for inline handlers
window.reviewCallLink = async (callId) => {
  await showCallReviewModal(callId)
}

window.closeCallReviewModal = () => {
  const modal = document.getElementById('call-review-modal')
  if (modal) {
    modal.remove()
  }
}

window.linkCallToSite = async (callId, siteId) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    alert('You must be logged in to link calls')
    return
  }
  
  const result = await manuallyLinkCall(callId, siteId, user.id)
  if (result.success) {
    alert('Call linked successfully')
    closeCallReviewModal()
    // Refresh the calls timeline if it exists
    const callItem = document.querySelector(`[data-call-id="${callId}"]`)
    if (callItem) {
      // Reload the timeline
      const siteId = callItem.closest('[data-site-id]')?.dataset?.siteId
      if (siteId) {
        await renderCallsTimeline(siteId)
      }
    }
  } else {
    alert('Error linking call: ' + (result.error || 'Unknown error'))
  }
}

window.createNextActionTask = async (callId, actionText) => {
  // TODO: Integrate with task creation system
  // For now, just mark as created
  const { error } = await supabase
    .from('calls')
    .update({ next_action_created: true })
    .eq('id', callId)
  
  if (error) {
    alert('Error creating task: ' + error.message)
  } else {
    alert('Task created: ' + actionText)
    // Refresh the call item
    const callItem = document.querySelector(`[data-call-id="${callId}"]`)
    if (callItem) {
      const siteId = callItem.closest('[data-site-id]')?.dataset?.siteId
      if (siteId) {
        await renderCallsTimeline(siteId)
      }
    }
  }
}

export default {
  renderCallTimelineItem,
  renderCallsTimeline,
  createClickToCallButton,
  showCallReviewModal
}
