/**
 * Test Factories for Domain Objects
 * Creates test data for users, sites, jobs, bookings, calls, quotes, etc.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zqcbldgheimqrnqmbbed.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_SERVICE_KEY) {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not set. Tests may fail.')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

/**
 * User Factory
 */
export async function createTestUser(overrides = {}) {
  const userData = {
    email: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@test.com`,
    password: 'TestPassword123!',
    full_name: overrides.full_name || 'Test User',
    role: overrides.role || 'client',
    ...overrides
  }

  // Create auth user
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: userData.email,
    password: userData.password,
    email_confirm: true,
    user_metadata: {
      full_name: userData.full_name,
      role: userData.role
    }
  })

  if (authError) throw authError

  // Create profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .insert({
      id: authUser.user.id,
      email: userData.email,
      full_name: userData.full_name,
      role: userData.role,
      status: 'active'
    })
    .select()
    .single()

  if (profileError) throw profileError

  return {
    auth: authUser.user,
    profile,
    password: userData.password
  }
}

/**
 * Site Factory (represents lead/deal in sales context)
 */
export async function createTestSite(userId, overrides = {}) {
  const siteData = {
    name: overrides.name || `Test Site ${Date.now()}`,
    address: overrides.address || '123 Test St, Test City, TC 12345',
    status: overrides.status || 'Active',
    square_footage: overrides.square_footage || 1000,
    contact_phone: overrides.contact_phone || '+15551234567',
    contact_email: overrides.contact_email || `site-${Date.now()}@test.com`,
    deal_value: overrides.deal_value || null,
    notes: overrides.notes || null,
    created_by: userId,
    ...overrides
  }

  const { data: site, error } = await supabase
    .from('sites')
    .insert(siteData)
    .select()
    .single()

  if (error) throw error
  return site
}

/**
 * Job Factory
 */
export async function createTestJob(userId, siteId, overrides = {}) {
  const jobData = {
    title: overrides.title || `Test Job ${Date.now()}`,
    site_id: siteId,
    client_id: userId,
    job_type: overrides.job_type || 'cleaning',
    description: overrides.description || 'Test job description',
    scheduled_date: overrides.scheduled_date || new Date().toISOString().split('T')[0],
    status: overrides.status || 'pending',
    frequency: overrides.frequency || 'single visit',
    created_by: userId,
    ...overrides
  }

  const { data: job, error } = await supabase
    .from('jobs')
    .insert(jobData)
    .select()
    .single()

  if (error) throw error
  return job
}

/**
 * Booking Factory
 */
export async function createTestBooking(userId, siteId, overrides = {}) {
  const bookingData = {
    title: overrides.title || `Test Booking ${Date.now()}`,
    site_id: siteId,
    client_id: userId,
    description: overrides.description || 'Test booking description',
    scheduled_date: overrides.scheduled_date || new Date().toISOString().split('T')[0],
    status: overrides.status || 'pending',
    frequency: overrides.frequency || 'single visit',
    created_by: userId,
    ...overrides
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .insert(bookingData)
    .select()
    .single()

  if (error) throw error
  return booking
}

/**
 * Call Factory (Quo webhook data)
 */
export async function createTestCall(siteId, overrides = {}) {
  const callData = {
    quo_call_id: overrides.quo_call_id || `quo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    quo_contact_id: overrides.quo_contact_id || null,
    direction: overrides.direction || 'inbound',
    outcome: overrides.outcome || 'answered',
    status: overrides.status || 'completed',
    from_number: overrides.from_number || '+15551234567',
    to_number: overrides.to_number || '+15559876543',
    from_number_raw: overrides.from_number_raw || '(555) 123-4567',
    to_number_raw: overrides.to_number_raw || '(555) 987-6543',
    started_at: overrides.started_at || new Date().toISOString(),
    answered_at: overrides.answered_at || new Date().toISOString(),
    ended_at: overrides.ended_at || new Date().toISOString(),
    duration_seconds: overrides.duration_seconds || 120,
    site_id: siteId,
    linked_by: overrides.linked_by || 'phone_match',
    has_consent: overrides.has_consent || false,
    transcript: overrides.transcript || null,
    recording_url: overrides.recording_url || null,
    summary: overrides.summary || null,
    ...overrides
  }

  const { data: call, error } = await supabase
    .from('calls')
    .insert(callData)
    .select()
    .single()

  if (error) throw error
  return call
}

/**
 * Quote Factory (when implemented)
 */
export async function createTestQuote(userId, siteId, overrides = {}) {
  // This will be implemented when quote system is added
  // For now, return a mock structure
  return {
    id: `quote-${Date.now()}`,
    site_id: siteId,
    created_by: userId,
    status: overrides.status || 'draft',
    amount: overrides.amount || 1000,
    ...overrides
  }
}

/**
 * Quo Webhook Log Factory
 */
export async function createTestWebhookLog(overrides = {}) {
  const webhookData = {
    webhook_id: overrides.webhook_id || `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    event_type: overrides.event_type || 'call.ended',
    payload: overrides.payload || {
      call_id: `quo-${Date.now()}`,
      direction: 'inbound',
      outcome: 'answered'
    },
    signature: overrides.signature || null,
    signature_valid: overrides.signature_valid || null,
    processed: overrides.processed || false,
    ...overrides
  }

  const { data: log, error } = await supabase
    .from('quo_webhook_logs')
    .insert(webhookData)
    .select()
    .single()

  if (error) throw error
  return log
}

/**
 * Cleanup helper - deletes test data
 */
export async function cleanupTestData(ids) {
  const { userIds = [], siteIds = [], jobIds = [], bookingIds = [], callIds = [] } = ids

  // Delete in reverse order of dependencies
  if (callIds.length > 0) {
    await supabase.from('calls').delete().in('id', callIds)
  }
  if (bookingIds.length > 0) {
    await supabase.from('bookings').delete().in('id', bookingIds)
  }
  if (jobIds.length > 0) {
    await supabase.from('jobs').delete().in('id', jobIds)
  }
  if (siteIds.length > 0) {
    await supabase.from('sites').delete().in('id', siteIds)
  }
  if (userIds.length > 0) {
    for (const userId of userIds) {
      await supabase.auth.admin.deleteUser(userId)
    }
  }
}
