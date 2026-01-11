// ============================================
// Quo Integration Module
// ============================================
// Handles Quo call tracking integration:
// - Phone number normalization
// - Call linking to sites
// - Click-to-call functionality
// ============================================

import { supabase } from '../supabase.js'

// ============================================
// Phone Number Normalization (E.164)
// ============================================

/**
 * Normalize phone number to E.164 format
 * @param {string} phone - Phone number in any format
 * @param {string} defaultCountryCode - Default country code (e.g., '1' for US/Canada)
 * @returns {string|null} - Normalized E.164 format or null if invalid
 */
export function normalizePhoneNumber(phone, defaultCountryCode = '1') {
  if (!phone) return null
  
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '')
  
  if (digits.length === 0) return null
  
  // If starts with country code, use as-is
  if (digits.startsWith('1') && digits.length === 11) {
    return `+${digits}`
  }
  
  // If 10 digits, assume US/Canada and add country code
  if (digits.length === 10) {
    return `+${defaultCountryCode}${digits}`
  }
  
  // If 11 digits and starts with 1, add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  
  // If already has +, return as-is (assuming valid)
  if (phone.startsWith('+')) {
    return phone.replace(/\D/g, '').replace(/^(\d+)/, '+$1')
  }
  
  // Try to parse as-is
  if (digits.length >= 10) {
    return `+${digits}`
  }
  
  return null
}

/**
 * Format phone number for display
 * @param {string} phone - E.164 phone number
 * @returns {string} - Formatted phone number
 */
export function formatPhoneNumber(phone) {
  if (!phone) return ''
  
  // Remove + and extract digits
  const digits = phone.replace(/\D/g, '')
  
  if (digits.length === 11 && digits.startsWith('1')) {
    // US/Canada format: (XXX) XXX-XXXX
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  
  if (digits.length === 10) {
    // 10-digit format: (XXX) XXX-XXXX
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  
  // Return original if can't format
  return phone
}

// ============================================
// Call Linking Logic
// ============================================

/**
 * Link a call to a site by phone number or Quo contact mapping
 * @param {object} callData - Call data with from_number, to_number, quo_contact_id
 * @returns {Promise<object>} - Linking result with site_id, linked_by, needs_review
 */
export async function linkCallToSite(callData) {
  const { from_number, to_number, quo_contact_id, internal_reference } = callData
  
  // Priority 1: Internal reference (deal_id/lead_id from webhook)
  if (internal_reference?.site_id) {
    return {
      site_id: internal_reference.site_id,
      linked_by: 'internal_reference',
      needs_review: false
    }
  }
  
  // Priority 2: Quo contact mapping
  if (quo_contact_id) {
    const { data: mapping } = await supabase
      .from('quo_contact_mappings')
      .select('site_id')
      .eq('quo_contact_id', quo_contact_id)
      .single()
    
    if (mapping?.site_id) {
      return {
        site_id: mapping.site_id,
        linked_by: 'quo_contact',
        needs_review: false
      }
    }
  }
  
  // Priority 3: Phone number matching
  // Try both from_number and to_number
  const phoneNumbers = [from_number, to_number].filter(Boolean)
  const matches = []
  
  for (const phone of phoneNumbers) {
    const normalized = normalizePhoneNumber(phone)
    if (!normalized) continue
    
    // Search in sites table
    const { data: sites } = await supabase
      .from('sites')
      .select('id, contact_phone, name, status')
      .or(`contact_phone.eq.${normalized},contact_phone.eq.${phone}`)
    
    if (sites && sites.length > 0) {
      // Filter to active sites and sort by most recent
      const activeSites = sites
        .filter(s => s.status === 'Active')
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      
      if (activeSites.length > 0) {
        matches.push(...activeSites.map(s => ({ site_id: s.id, phone, site_name: s.name })))
      }
    }
  }
  
  // Remove duplicates
  const uniqueMatches = matches.filter((match, index, self) =>
    index === self.findIndex(m => m.site_id === match.site_id)
  )
  
  if (uniqueMatches.length === 0) {
    return {
      site_id: null,
      linked_by: null,
      needs_review: false
    }
  }
  
  if (uniqueMatches.length === 1) {
    return {
      site_id: uniqueMatches[0].site_id,
      linked_by: 'phone_match',
      needs_review: false
    }
  }
  
  // Multiple matches - pick most recent active deal but flag for review
  return {
    site_id: uniqueMatches[0].site_id,
    linked_by: 'phone_match',
    needs_review: true
  }
}

// ============================================
// Click-to-Call Functionality
// ============================================

/**
 * Generate Quo click-to-call deep link
 * @param {string} phoneNumber - Phone number to call (E.164 format preferred)
 * @param {object} options - Additional options
 * @returns {string} - Deep link URL or tel: link
 */
export function generateClickToCallLink(phoneNumber, options = {}) {
  const { siteId, siteName } = options
  
  // Normalize phone number
  const normalized = normalizePhoneNumber(phoneNumber)
  if (!normalized) {
    console.warn('Invalid phone number for click-to-call:', phoneNumber)
    return `tel:${phoneNumber.replace(/\D/g, '')}`
  }
  
  // Check if we're on mobile or desktop
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  
  // Quo deep link format (adjust based on Quo's actual API)
  // Format: quo://call?phone=+1234567890 or https://app.quo.com/call?phone=+1234567890
  const quoAppLink = `quo://call?phone=${encodeURIComponent(normalized)}`
  const quoWebLink = `https://app.quo.com/call?phone=${encodeURIComponent(normalized)}`
  
  // Fallback to tel: link
  const telLink = `tel:${normalized.replace(/\+/g, '')}`
  
  // On mobile, try to open Quo app, fallback to tel:
  if (isMobile) {
    // Try to open Quo app
    // If app is not installed, this will fail gracefully and we can fallback
    return quoAppLink
  }
  
  // On desktop, use web link or tel: link
  return quoWebLink
}

/**
 * Initiate click-to-call
 * @param {string} phoneNumber - Phone number to call
 * @param {object} options - Additional options
 */
export async function initiateClickToCall(phoneNumber, options = {}) {
  const { siteId, siteName } = options
  
  try {
    const link = generateClickToCallLink(phoneNumber, options)
    
    // Log the call initiation for tracking
    if (siteId) {
      await supabase
        .from('call_events')
        .insert({
          event_type: 'click_to_call_initiated',
          event_data: {
            phone_number: phoneNumber,
            site_id: siteId,
            site_name: siteName,
            link_type: link.startsWith('quo://') ? 'app' : link.startsWith('https://') ? 'web' : 'tel'
          }
        })
    }
    
    // Open the link
    if (link.startsWith('quo://') || link.startsWith('https://')) {
      // For app/web links, open in new window/tab
      window.open(link, '_blank')
    } else {
      // For tel: links, use location.href
      window.location.href = link
    }
    
    return { success: true, link }
  } catch (error) {
    console.error('Error initiating click-to-call:', error)
    return { success: false, error: error.message }
  }
}

// ============================================
// Call Data Fetching
// ============================================

/**
 * Get calls for a site
 * @param {number} siteId - Site ID
 * @param {object} options - Query options
 * @returns {Promise<Array>} - Array of calls
 */
export async function getCallsForSite(siteId, options = {}) {
  const { limit = 50, offset = 0, orderBy = 'started_at', order = 'desc' } = options
  
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .eq('site_id', siteId)
    .order(orderBy, { ascending: order === 'asc' })
    .limit(limit)
    .range(offset, offset + limit - 1)
  
  if (error) {
    console.error('Error fetching calls:', error)
    return []
  }
  
  return data || []
}

/**
 * Get call by ID
 * @param {string} callId - Call UUID
 * @returns {Promise<object|null>} - Call object or null
 */
export async function getCallById(callId) {
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .eq('id', callId)
    .single()
  
  if (error) {
    console.error('Error fetching call:', error)
    return null
  }
  
  return data
}

/**
 * Get calls that need review (multiple matches)
 * @returns {Promise<Array>} - Array of calls needing review
 */
export async function getCallsNeedingReview() {
  const { data, error } = await supabase
    .from('calls')
    .select('*, sites(name, contact_phone)')
    .eq('needs_review', true)
    .order('started_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching calls needing review:', error)
    return []
  }
  
  return data || []
}

// ============================================
// Manual Call Linking
// ============================================

/**
 * Manually link a call to a site
 * @param {string} callId - Call UUID
 * @param {number} siteId - Site ID
 * @param {string} userId - User ID performing the link
 * @returns {Promise<object>} - Update result
 */
export async function manuallyLinkCall(callId, siteId, userId) {
  const { data, error } = await supabase
    .from('calls')
    .update({
      site_id: siteId,
      linked_by: 'manual',
      needs_review: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', callId)
    .select()
    .single()
  
  if (error) {
    console.error('Error linking call:', error)
    return { success: false, error: error.message }
  }
  
  // Log the event
  await supabase
    .from('call_events')
    .insert({
      call_id: callId,
      event_type: 'manually_linked',
      event_data: { site_id: siteId },
      created_by: userId
    })
  
  return { success: true, call: data }
}

// ============================================
// Quo Contact Mapping
// ============================================

/**
 * Map a Quo contact to a site
 * @param {string} quoContactId - Quo contact ID
 * @param {number} siteId - Site ID
 * @param {string} userId - User ID
 * @param {string} phoneNumber - Optional phone number
 * @returns {Promise<object>} - Mapping result
 */
export async function mapQuoContactToSite(quoContactId, siteId, userId, phoneNumber = null) {
  const normalizedPhone = phoneNumber ? normalizePhoneNumber(phoneNumber) : null
  
  const { data, error } = await supabase
    .from('quo_contact_mappings')
    .upsert({
      quo_contact_id: quoContactId,
      site_id: siteId,
      phone_number: normalizedPhone,
      mapped_by: userId,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'quo_contact_id'
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error mapping Quo contact:', error)
    return { success: false, error: error.message }
  }
  
  return { success: true, mapping: data }
}

// Export all functions
export default {
  normalizePhoneNumber,
  formatPhoneNumber,
  linkCallToSite,
  generateClickToCallLink,
  initiateClickToCall,
  getCallsForSite,
  getCallById,
  getCallsNeedingReview,
  manuallyLinkCall,
  mapQuoContactToSite
}
