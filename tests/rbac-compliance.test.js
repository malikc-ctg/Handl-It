/**
 * RBAC and Compliance Tests
 * 
 * Run with: deno test --allow-net --allow-env tests/rbac-compliance.test.js
 * Or use a Node.js test runner like Jest/Vitest
 */

import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { supabase } from '../js/supabase.js'
import * as rbac from '../js/rbac-service.js'

// Test configuration
const TEST_ADMIN_EMAIL = 'admin@test.com'
const TEST_MANAGER_EMAIL = 'manager@test.com'
const TEST_REP_EMAIL = 'rep@test.com'

/**
 * Helper: Get authenticated Supabase client for a user
 */
async function getAuthClient(email) {
  // In a real test, you'd sign in as the test user
  // For now, we'll assume test users exist
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: 'test-password'
  })
  if (error) throw error
  return supabase
}

/**
 * Test Suite: Role-Based Access Control
 */
Deno.test('RBAC: Admin can access all resources', async () => {
  const client = await getAuthClient(TEST_ADMIN_EMAIL)
  
  // Admin should have admin role
  const role = await rbac.getUserRole()
  assertEquals(role, 'admin')
  
  // Admin should be able to assert any permission
  try {
    await rbac.assertPermission('deal.read', { id: 'any-deal-id' })
    await rbac.assertPermission('quote.approve', { id: 'any-quote-id' })
    await rbac.assertPermission('audit.read', {})
  } catch (error) {
    assert(false, `Admin should have all permissions: ${error.message}`)
  }
})

Deno.test('RBAC: Manager can view team deals', async () => {
  const client = await getAuthClient(TEST_MANAGER_EMAIL)
  
  const role = await rbac.getUserRole()
  assertEquals(role, 'manager')
  
  // Manager should be able to approve quotes
  try {
    await rbac.assertPermission('quote.approve', { id: 'team-quote-id' })
  } catch (error) {
    assert(false, `Manager should be able to approve quotes: ${error.message}`)
  }
  
  // Manager should NOT be able to view audit logs
  try {
    await rbac.assertPermission('audit.read', {})
    assert(false, 'Manager should NOT be able to view audit logs')
  } catch (error) {
    // Expected error
    assert(error.message.includes('Permission denied'))
  }
})

Deno.test('RBAC: Rep can create quotes but not approve', async () => {
  const client = await getAuthClient(TEST_REP_EMAIL)
  
  const role = await rbac.getUserRole()
  assertEquals(role, 'rep')
  
  // Rep should be able to create quotes
  try {
    await rbac.assertPermission('quote.create', {})
  } catch (error) {
    assert(false, `Rep should be able to create quotes: ${error.message}`)
  }
  
  // Rep should NOT be able to approve quotes
  try {
    await rbac.assertPermission('quote.approve', { id: 'quote-id' })
    assert(false, 'Rep should NOT be able to approve quotes')
  } catch (error) {
    // Expected error
    assert(error.message.includes('Permission denied') || error.message.includes('Requires role'))
  }
})

/**
 * Test Suite: Compliance - Call Consent
 */
Deno.test('Compliance: Cannot store recording without consent', async () => {
  const client = await getAuthClient(TEST_REP_EMAIL)
  
  // Create a call without consent
  const { data: call, error: callError } = await supabase
    .from('calls')
    .insert({
      caller_id: (await supabase.auth.getUser()).data.user.id,
      recording_consent: false,  // NO CONSENT
      transcript_consent: false
    })
    .select()
    .single()
  
  if (callError) throw callError
  
  // Verify consent check fails
  const hasConsent = await rbac.checkCallConsent(call.id, 'recording')
  assertEquals(hasConsent, false)
  
  // Try to insert recording - should fail
  const { data: recording, error: recordingError } = await supabase
    .from('call_recordings')
    .insert({
      call_id: call.id,
      recording_url: 'https://example.com/recording.mp3'
    })
  
  // Should fail with RLS policy error
  assert(recordingError !== null, 'Should fail to insert recording without consent')
  
  // Cleanup
  await supabase.from('calls').delete().eq('id', call.id)
})

Deno.test('Compliance: Can store recording with consent', async () => {
  const client = await getAuthClient(TEST_REP_EMAIL)
  
  // Create a call WITH consent
  const { data: call, error: callError } = await supabase
    .from('calls')
    .insert({
      caller_id: (await supabase.auth.getUser()).data.user.id,
      recording_consent: true,  // CONSENT GIVEN
      transcript_consent: true
    })
    .select()
    .single()
  
  if (callError) throw callError
  
  // Verify consent check passes
  const hasConsent = await rbac.checkCallConsent(call.id, 'recording')
  assertEquals(hasConsent, true)
  
  // Should be able to insert recording
  const { data: recording, error: recordingError } = await supabase
    .from('call_recordings')
    .insert({
      call_id: call.id,
      recording_url: 'https://example.com/recording.mp3',
      storage_path: '/recordings/test.mp3',
      consent_verified: true
    })
    .select()
    .single()
  
  assert(recordingError === null, `Should be able to insert recording with consent: ${recordingError?.message}`)
  
  // Cleanup
  await supabase.from('call_recordings').delete().eq('id', recording.id)
  await supabase.from('calls').delete().eq('id', call.id)
})

/**
 * Test Suite: Compliance - Location Tracking
 */
Deno.test('Compliance: Cannot record location when route is not active', async () => {
  const client = await getAuthClient(TEST_REP_EMAIL)
  const userId = (await supabase.auth.getUser()).data.user.id
  
  // Create a route that is NOT active
  const { data: route, error: routeError } = await supabase
    .from('routes')
    .insert({
      name: 'Test Route',
      assigned_to: userId,
      status: 'planned',  // NOT ACTIVE
      location_tracking_enabled: true
    })
    .select()
    .single()
  
  if (routeError) throw routeError
  
  // Verify location tracking check fails
  const allowed = await rbac.checkLocationTrackingAllowed(route.id)
  assertEquals(allowed, false)
  
  // Try to insert location - should fail
  const { data: location, error: locationError } = await supabase
    .from('route_locations')
    .insert({
      route_id: route.id,
      user_id: userId,
      latitude: 43.6532,
      longitude: -79.3832
    })
  
  // Should fail with RLS policy error
  assert(locationError !== null, 'Should fail to insert location when route is not active')
  
  // Cleanup
  await supabase.from('routes').delete().eq('id', route.id)
})

Deno.test('Compliance: Can record location when route is active', async () => {
  const client = await getAuthClient(TEST_REP_EMAIL)
  const userId = (await supabase.auth.getUser()).data.user.id
  
  // Create an ACTIVE route with tracking enabled
  const { data: route, error: routeError } = await supabase
    .from('routes')
    .insert({
      name: 'Test Route',
      assigned_to: userId,
      status: 'active',  // ACTIVE
      location_tracking_enabled: true,  // TRACKING ENABLED
      started_at: new Date().toISOString()
    })
    .select()
    .single()
  
  if (routeError) throw routeError
  
  // Verify location tracking check passes
  const allowed = await rbac.checkLocationTrackingAllowed(route.id)
  assertEquals(allowed, true)
  
  // Should be able to insert location
  const { data: location, error: locationError } = await supabase
    .from('route_locations')
    .insert({
      route_id: route.id,
      user_id: userId,
      latitude: 43.6532,
      longitude: -79.3832
    })
    .select()
    .single()
  
  assert(locationError === null, `Should be able to insert location when route is active: ${locationError?.message}`)
  
  // Cleanup
  await supabase.from('route_locations').delete().eq('id', location.id)
  await supabase.from('routes').delete().eq('id', route.id)
})

Deno.test('Compliance: Cannot record location when tracking is disabled', async () => {
  const client = await getAuthClient(TEST_REP_EMAIL)
  const userId = (await supabase.auth.getUser()).data.user.id
  
  // Create an active route but tracking DISABLED
  const { data: route, error: routeError } = await supabase
    .from('routes')
    .insert({
      name: 'Test Route',
      assigned_to: userId,
      status: 'active',
      location_tracking_enabled: false,  // TRACKING DISABLED
      started_at: new Date().toISOString()
    })
    .select()
    .single()
  
  if (routeError) throw routeError
  
  // Verify location tracking check fails
  const allowed = await rbac.checkLocationTrackingAllowed(route.id)
  assertEquals(allowed, false)
  
  // Try to insert location - should fail
  const { data: location, error: locationError } = await supabase
    .from('route_locations')
    .insert({
      route_id: route.id,
      user_id: userId,
      latitude: 43.6532,
      longitude: -79.3832
    })
  
  // Should fail with RLS policy error
  assert(locationError !== null, 'Should fail to insert location when tracking is disabled')
  
  // Cleanup
  await supabase.from('routes').delete().eq('id', route.id)
})

/**
 * Test Suite: Audit Logging
 */
Deno.test('Audit: Deal stage change is logged', async () => {
  const client = await getAuthClient(TEST_ADMIN_EMAIL)
  
  // Create a deal
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .insert({
      title: 'Test Deal',
      stage: 'lead',
      created_by: (await supabase.auth.getUser()).data.user.id
    })
    .select()
    .single()
  
  if (dealError) throw dealError
  
  // Update stage (should trigger audit log)
  const { error: updateError } = await supabase
    .from('deals')
    .update({ stage: 'qualified' })
    .eq('id', deal.id)
  
  if (updateError) throw updateError
  
  // Wait a bit for trigger to execute
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Check audit log (admin can view)
  const { data: auditLogs, error: logError } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('target_id', deal.id)
    .eq('action', 'deal.stage_change')
    .order('created_at', { ascending: false })
    .limit(1)
  
  assert(logError === null, `Should be able to query audit logs: ${logError?.message}`)
  assert(auditLogs && auditLogs.length > 0, 'Audit log should be created for stage change')
  assertEquals(auditLogs[0].before_state.stage, 'lead')
  assertEquals(auditLogs[0].after_state.stage, 'qualified')
  
  // Cleanup
  await supabase.from('deals').delete().eq('id', deal.id)
})

Deno.test('Audit: Quote send is logged', async () => {
  const client = await getAuthClient(TEST_REP_EMAIL)
  const userId = (await supabase.auth.getUser()).data.user.id
  
  // Create a deal first
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .insert({
      title: 'Test Deal',
      stage: 'proposal',
      created_by: userId
    })
    .select()
    .single()
  
  if (dealError) throw dealError
  
  // Create a quote
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({
      deal_id: deal.id,
      quote_number: `Q-${Date.now()}`,
      title: 'Test Quote',
      amount: 1000.00,
      status: 'draft',
      created_by: userId
    })
    .select()
    .single()
  
  if (quoteError) throw quoteError
  
  // Send quote (should trigger audit log)
  const { error: sendError } = await supabase
    .from('quotes')
    .update({ 
      status: 'sent',
      sent_at: new Date().toISOString()
    })
    .eq('id', quote.id)
  
  if (sendError) throw sendError
  
  // Wait a bit for trigger to execute
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Check audit log (admin can view)
  const adminClient = await getAuthClient(TEST_ADMIN_EMAIL)
  const { data: auditLogs, error: logError } = await adminClient
    .from('audit_logs')
    .select('*')
    .eq('target_id', quote.id)
    .eq('action', 'quote.send')
    .order('created_at', { ascending: false })
    .limit(1)
  
  assert(logError === null, `Should be able to query audit logs: ${logError?.message}`)
  assert(auditLogs && auditLogs.length > 0, 'Audit log should be created for quote send')
  assertEquals(auditLogs[0].after_state.status, 'sent')
  
  // Cleanup
  await supabase.from('quotes').delete().eq('id', quote.id)
  await supabase.from('deals').delete().eq('id', deal.id)
})

/**
 * Test Suite: Permission Error Messages
 */
Deno.test('Error Messages: User-friendly permission errors', async () => {
  const client = await getAuthClient(TEST_REP_EMAIL)
  
  try {
    await rbac.assertPermission('audit.read', {})
    assert(false, 'Should have thrown error')
  } catch (error) {
    const message = rbac.getPermissionErrorMessage(error)
    assert(message.includes('admin') || message.includes('permission'), 
      `Error message should be user-friendly: ${message}`)
  }
})

// Run tests
console.log('✅ RBAC and Compliance test suite loaded')
console.log('Run with: deno test --allow-net --allow-env tests/rbac-compliance.test.js')
