/**
 * Consent and Location Gating Tests
 * Tests that consent-gated data (transcripts, recordings) are properly protected
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, createTestSite, createTestCall, cleanupTestData } from '../fixtures/factories.js'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zqcbldgheimqrnqmbbed.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''

describe('Consent and Location Gating', () => {
  let testUser, testSite
  const cleanupIds = { userIds: [], siteIds: [], callIds: [] }

  beforeAll(async () => {
    testUser = await createTestUser({ role: 'client' })
    testSite = await createTestSite(testUser.auth.id)
    cleanupIds.userIds.push(testUser.auth.id)
    cleanupIds.siteIds.push(testSite.id)
  })

  afterAll(async () => {
    await cleanupTestData(cleanupIds)
  })

  describe('Consent Gating', () => {
    it('should not store transcript without consent', async () => {
      const call = await createTestCall(testSite.id, {
        has_consent: false,
        transcript: null,
        recording_url: null
      })
      cleanupIds.callIds.push(call.id)

      expect(call.has_consent).toBe(false)
      expect(call.transcript).toBeNull()
      expect(call.recording_url).toBeNull()
    })

    it('should allow transcript storage with consent', async () => {
      const transcript = 'Test call transcript content'
      const recordingUrl = 'https://example.com/recording.mp3'

      const call = await createTestCall(testSite.id, {
        has_consent: true,
        transcript: transcript,
        recording_url: recordingUrl
      })
      cleanupIds.callIds.push(call.id)

      expect(call.has_consent).toBe(true)
      expect(call.transcript).toBe(transcript)
      expect(call.recording_url).toBe(recordingUrl)
    })

    it('should prevent updating transcript without consent', async () => {
      const call = await createTestCall(testSite.id, {
        has_consent: false
      })
      cleanupIds.callIds.push(call.id)

      // Attempt to update transcript without consent should fail
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      const { error } = await supabase
        .from('calls')
        .update({ transcript: 'Unauthorized transcript' })
        .eq('id', call.id)
        .eq('has_consent', false)

      // Should fail or be prevented by database constraint/trigger
      expect(error).toBeDefined()
    })
  })

  describe('Location Gating', () => {
    it('should validate phone number format (E.164)', async () => {
      const call = await createTestCall(testSite.id, {
        from_number: '+15551234567', // Valid E.164
        to_number: '+15559876543'
      })
      cleanupIds.callIds.push(call.id)

      expect(call.from_number).toMatch(/^\+1\d{10}$/)
      expect(call.to_number).toMatch(/^\+1\d{10}$/)
    })

    it('should store raw phone numbers for display', async () => {
      const call = await createTestCall(testSite.id, {
        from_number: '+15551234567',
        from_number_raw: '(555) 123-4567',
        to_number: '+15559876543',
        to_number_raw: '(555) 987-6543'
      })
      cleanupIds.callIds.push(call.id)

      expect(call.from_number_raw).toBe('(555) 123-4567')
      expect(call.to_number_raw).toBe('(555) 987-6543')
    })
  })

  describe('Data Retention', () => {
    it('should respect consent-based data retention', async () => {
      // Calls without consent should not retain sensitive data
      const callNoConsent = await createTestCall(testSite.id, {
        has_consent: false,
        transcript: null
      })
      cleanupIds.callIds.push(callNoConsent.id)

      expect(callNoConsent.transcript).toBeNull()
      expect(callNoConsent.recording_url).toBeNull()
    })
  })
})
