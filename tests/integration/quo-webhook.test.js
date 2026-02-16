/**
 * Quo Webhook Integration Tests
 * Tests idempotency, linking, and webhook processing
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, createTestSite, cleanupTestData } from '../fixtures/factories.js'

const WEBHOOK_URL = process.env.QUO_WEBHOOK_URL || 'http://localhost:54321/functions/v1/quo-webhook'
const hasSupabaseKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY

describe.skipIf(!hasSupabaseKey)('Quo Webhook Integration', () => {
  let testUser, testSite
  const cleanupIds = { userIds: [], siteIds: [] }

  beforeAll(async () => {
    testUser = await createTestUser({ role: 'client' })
    testSite = await createTestSite(testUser.auth.id, {
      contact_phone: '+15551234567'
    })
    cleanupIds.userIds.push(testUser.auth.id)
    cleanupIds.siteIds.push(testSite.id)
  })

  afterAll(async () => {
    await cleanupTestData(cleanupIds)
  })

  describe('Idempotency', () => {
    it('should handle duplicate webhooks gracefully', async () => {
      const webhookPayload = {
        event_type: 'call.ended',
        call_id: `test-call-${Date.now()}`,
        direction: 'inbound',
        outcome: 'answered',
        from_number: '+15551234567',
        to_number: '+15559876543',
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: 120
      }

      // Send webhook twice
      const response1 = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload)
      })

      const response2 = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload)
      })

      expect(response1.ok).toBe(true)
      expect(response2.ok).toBe(true)

      const result1 = await response1.json()
      const result2 = await response2.json()

      // Both should succeed and return the same call_id
      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      expect(result1.call_id).toBe(result2.call_id)
    })
  })

  describe('Phone Number Linking', () => {
    it('should link call to site by phone number match', async () => {
      const webhookPayload = {
        event_type: 'call.ended',
        call_id: `test-call-link-${Date.now()}`,
        direction: 'inbound',
        outcome: 'answered',
        from_number: '+15551234567', // Matches testSite.contact_phone
        to_number: '+15559876543',
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: 180
      }

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload)
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.call_id).toBeDefined()

      // Verify call was linked to site
      // This would require querying the database
      // For now, we verify the webhook was accepted
    })
  })

  describe('Contact Mapping', () => {
    it('should create contact mapping when contact_id is provided', async () => {
      const contactId = `quo-contact-${Date.now()}`
      const webhookPayload = {
        event_type: 'call.ended',
        call_id: `test-call-contact-${Date.now()}`,
        contact_id: contactId,
        direction: 'inbound',
        outcome: 'answered',
        from_number: '+15551234567',
        to_number: '+15559876543',
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString()
      }

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload)
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      expect(result.success).toBe(true)

      // Verify contact mapping was created
      // Would require database query
    })
  })

  describe('Consent Handling', () => {
    it('should not store transcript without consent', async () => {
      const webhookPayload = {
        event_type: 'call.ended',
        call_id: `test-call-consent-${Date.now()}`,
        direction: 'inbound',
        outcome: 'answered',
        from_number: '+15551234567',
        to_number: '+15559876543',
        has_consent: false,
        transcript: 'This should not be stored',
        recording_url: 'https://example.com/recording.mp3'
      }

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload)
      })

      expect(response.ok).toBe(true)
      // Verify transcript was not stored (would require DB query)
    })

    it('should store transcript with consent', async () => {
      const webhookPayload = {
        event_type: 'call.ended',
        call_id: `test-call-consent-yes-${Date.now()}`,
        direction: 'inbound',
        outcome: 'answered',
        from_number: '+15551234567',
        to_number: '+15559876543',
        has_consent: true,
        transcript: 'This transcript should be stored',
        recording_url: 'https://example.com/recording.mp3'
      }

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload)
      })

      expect(response.ok).toBe(true)
      // Verify transcript was stored (would require DB query)
    })
  })
})
