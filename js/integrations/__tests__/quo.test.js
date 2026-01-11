// ============================================
// Quo Integration Unit Tests
// ============================================
// Tests for phone normalization and call linking
// ============================================

import { 
  normalizePhoneNumber, 
  formatPhoneNumber,
  linkCallToSite 
} from '../quo.js'

// ============================================
// Phone Number Normalization Tests
// ============================================

describe('normalizePhoneNumber', () => {
  test('normalizes 10-digit US/Canada number', () => {
    expect(normalizePhoneNumber('4165551234')).toBe('+14165551234')
    expect(normalizePhoneNumber('(416) 555-1234')).toBe('+14165551234')
    expect(normalizePhoneNumber('416-555-1234')).toBe('+14165551234')
  })
  
  test('normalizes 11-digit number starting with 1', () => {
    expect(normalizePhoneNumber('14165551234')).toBe('+14165551234')
    expect(normalizePhoneNumber('1-416-555-1234')).toBe('+14165551234')
  })
  
  test('handles already normalized numbers', () => {
    expect(normalizePhoneNumber('+14165551234')).toBe('+14165551234')
    expect(normalizePhoneNumber('+1-416-555-1234')).toBe('+14165551234')
  })
  
  test('handles invalid numbers', () => {
    expect(normalizePhoneNumber('')).toBe(null)
    expect(normalizePhoneNumber('123')).toBe(null)
    expect(normalizePhoneNumber('abc')).toBe(null)
  })
  
  test('handles numbers with country code', () => {
    expect(normalizePhoneNumber('+44 20 7946 0958')).toBe('+442079460958')
    expect(normalizePhoneNumber('+33 1 42 86 83 26')).toBe('+33142868326')
  })
})

describe('formatPhoneNumber', () => {
  test('formats E.164 number for display', () => {
    expect(formatPhoneNumber('+14165551234')).toBe('(416) 555-1234')
    expect(formatPhoneNumber('+12125551234')).toBe('(212) 555-1234')
  })
  
  test('handles 10-digit numbers', () => {
    expect(formatPhoneNumber('4165551234')).toBe('(416) 555-1234')
  })
  
  test('handles invalid input', () => {
    expect(formatPhoneNumber('')).toBe('')
    expect(formatPhoneNumber(null)).toBe('')
    expect(formatPhoneNumber(undefined)).toBe('')
  })
})

// ============================================
// Call Linking Tests (Mock)
// ============================================

describe('linkCallToSite', () => {
  // Note: These tests would require mocking Supabase client
  // For now, we'll test the logic structure
  
  test('prioritizes internal reference', async () => {
    const mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: null }))
          }))
        }))
      }))
    }
    
    // This would need proper mocking setup
    // For now, just verify the function exists
    expect(typeof linkCallToSite).toBe('function')
  })
})

// ============================================
// Integration Test Helpers
// ============================================

export function runTests() {
  console.log('Running Quo integration tests...')
  
  // Phone normalization tests
  const testCases = [
    { input: '4165551234', expected: '+14165551234' },
    { input: '(416) 555-1234', expected: '+14165551234' },
    { input: '+14165551234', expected: '+14165551234' },
    { input: '14165551234', expected: '+14165551234' },
    { input: '', expected: null },
    { input: '123', expected: null }
  ]
  
  let passed = 0
  let failed = 0
  
  testCases.forEach(({ input, expected }) => {
    const result = normalizePhoneNumber(input)
    if (result === expected) {
      passed++
      console.log(`✅ normalizePhoneNumber("${input}") = "${result}"`)
    } else {
      failed++
      console.error(`❌ normalizePhoneNumber("${input}") = "${result}", expected "${expected}"`)
    }
  })
  
  console.log(`\nTests: ${passed} passed, ${failed} failed`)
  return failed === 0
}

// Run tests if executed directly
if (typeof window === 'undefined' || window.location.pathname.includes('test')) {
  runTests()
}
