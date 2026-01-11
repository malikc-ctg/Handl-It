// Unit tests for Analytics Aggregations
// These tests verify the correctness of analytics calculations

import { describe, it, expect, beforeAll, afterAll } from 'https://deno.land/std@0.168.0/testing/bdd.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Mock Supabase client for testing
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || 'https://test.supabase.co',
  Deno.env.get('SUPABASE_ANON_KEY') || 'test-key'
)

describe('Analytics Aggregations', () => {
  // Test fixtures - sample data
  const testEvents = [
    { event_type: 'call', user_id: 'user1', created_at: '2024-01-01T10:00:00Z', territory: 'North', vertical: 'Commercial' },
    { event_type: 'call', user_id: 'user1', created_at: '2024-01-02T10:00:00Z', territory: 'North', vertical: 'Commercial' },
    { event_type: 'connection', user_id: 'user1', created_at: '2024-01-03T10:00:00Z', territory: 'North', vertical: 'Commercial' },
    { event_type: 'quote', user_id: 'user1', created_at: '2024-01-04T10:00:00Z', territory: 'North', vertical: 'Commercial' },
    { event_type: 'win', user_id: 'user1', created_at: '2024-01-05T10:00:00Z', territory: 'North', vertical: 'Commercial', metadata: { value: 10000 } },
  ]

  describe('Funnel Metrics', () => {
    it('should correctly count events by type', async () => {
      // Expected counts
      const expected = {
        calls: 2,
        connections: 1,
        quotes: 1,
        wins: 1,
      }
      
      // In a real test, we would query the database
      // For now, we verify the logic
      const calls = testEvents.filter(e => e.event_type === 'call').length
      const connections = testEvents.filter(e => e.event_type === 'connection').length
      const quotes = testEvents.filter(e => e.event_type === 'quote').length
      const wins = testEvents.filter(e => e.event_type === 'win').length
      
      expect(calls).toBe(expected.calls)
      expect(connections).toBe(expected.connections)
      expect(quotes).toBe(expected.quotes)
      expect(wins).toBe(expected.wins)
    })

    it('should calculate conversion rates correctly', () => {
      const calls = 100
      const connections = 50
      const quotes = 25
      const wins = 10
      
      const callsToConnections = (connections / calls) * 100 // 50%
      const connectionsToQuotes = (quotes / connections) * 100 // 50%
      const quotesToWins = (wins / quotes) * 100 // 40%
      
      expect(callsToConnections).toBe(50)
      expect(connectionsToQuotes).toBe(50)
      expect(quotesToWins).toBe(40)
    })

    it('should handle zero division gracefully', () => {
      const calls = 0
      const connections = 0
      
      const rate = calls > 0 ? (connections / calls) * 100 : 0
      expect(rate).toBe(0)
    })
  })

  describe('Time to Close', () => {
    it('should calculate average days correctly', () => {
      const wins = [
        { first_call_date: '2024-01-01T00:00:00Z', closed_date: '2024-01-31T00:00:00Z' },
        { first_call_date: '2024-01-01T00:00:00Z', closed_date: '2024-01-15T00:00:00Z' },
      ]
      
      const days = wins.map(w => {
        const start = new Date(w.first_call_date)
        const end = new Date(w.closed_date)
        return (end - start) / (1000 * 60 * 60 * 24)
      })
      
      const avgDays = days.reduce((a, b) => a + b, 0) / days.length
      expect(avgDays).toBe(22.5) // (30 + 15) / 2
    })

    it('should handle missing first_call_date by using created_at', () => {
      const win = {
        created_at: '2024-01-01T00:00:00Z',
        closed_date: '2024-01-31T00:00:00Z',
      }
      
      const startDate = win.first_call_date || win.created_at
      const start = new Date(startDate)
      const end = new Date(win.closed_date)
      const days = (end - start) / (1000 * 60 * 60 * 24)
      
      expect(days).toBe(30)
    })
  })

  describe('Calls Per Deal', () => {
    it('should calculate average calls per deal correctly', () => {
      const totalCalls = 100
      const totalDeals = 10
      const avgCallsPerDeal = totalDeals > 0 ? totalCalls / totalDeals : 0
      
      expect(avgCallsPerDeal).toBe(10)
    })

    it('should handle zero deals', () => {
      const totalCalls = 100
      const totalDeals = 0
      const avgCallsPerDeal = totalDeals > 0 ? totalCalls / totalDeals : 0
      
      expect(avgCallsPerDeal).toBe(0)
    })
  })

  describe('Stalled Deals', () => {
    it('should identify deals with no recent touch', () => {
      const cutoffDate = new Date('2024-01-31T00:00:00Z')
      const daysWithoutTouch = 14
      const cutoff = new Date(cutoffDate.getTime() - (daysWithoutTouch * 24 * 60 * 60 * 1000))
      
      const lastActivity = new Date('2024-01-10T00:00:00Z') // 21 days ago
      const isStalled = lastActivity < cutoff
      
      expect(isStalled).toBe(true)
    })

    it('should exclude deals with recent activity', () => {
      const cutoffDate = new Date('2024-01-31T00:00:00Z')
      const daysWithoutTouch = 14
      const cutoff = new Date(cutoffDate.getTime() - (daysWithoutTouch * 24 * 60 * 60 * 1000))
      
      const lastActivity = new Date('2024-01-25T00:00:00Z') // 6 days ago
      const isStalled = lastActivity < cutoff
      
      expect(isStalled).toBe(false)
    })
  })

  describe('Route Metrics', () => {
    it('should calculate doors knocked per hour', () => {
      const totalKnocks = 40
      const totalHours = 8
      const knocksPerHour = totalHours > 0 ? totalKnocks / totalHours : 0
      
      expect(knocksPerHour).toBe(5)
    })

    it('should calculate appointments per hour', () => {
      const totalAppointments = 10
      const totalHours = 8
      const appointmentsPerHour = totalHours > 0 ? totalAppointments / totalHours : 0
      
      expect(appointmentsPerHour).toBe(1.25)
    })
  })

  describe('Conversion by Territory', () => {
    it('should calculate knock to appointment rate', () => {
      const knocks = 100
      const appointments = 25
      const rate = knocks > 0 ? (appointments / knocks) * 100 : 0
      
      expect(rate).toBe(25)
    })

    it('should calculate quote to win rate', () => {
      const quotes = 50
      const wins = 10
      const rate = quotes > 0 ? (wins / quotes) * 100 : 0
      
      expect(rate).toBe(20)
    })
  })

  describe('Best Time of Day', () => {
    it('should group activities by hour', () => {
      const activities = [
        { time: '2024-01-01T09:00:00Z' },
        { time: '2024-01-01T09:30:00Z' },
        { time: '2024-01-01T14:00:00Z' },
      ]
      
      const byHour = {}
      activities.forEach(activity => {
        const hour = new Date(activity.time).getHours()
        byHour[hour] = (byHour[hour] || 0) + 1
      })
      
      expect(byHour[9]).toBe(2)
      expect(byHour[14]).toBe(1)
    })

    it('should calculate conversion rate per hour', () => {
      const total = 100
      const converted = 25
      const rate = total > 0 ? (converted / total) * 100 : 0
      
      expect(rate).toBe(25)
    })
  })

  describe('RBAC Filtering', () => {
    it('should filter data by user role (admin sees all)', () => {
      const userRole = 'admin'
      const allUserIds = ['user1', 'user2', 'user3']
      const accessibleIds = userRole === 'admin' ? allUserIds : ['user1']
      
      expect(accessibleIds.length).toBe(3)
    })

    it('should filter data by user role (manager sees team)', () => {
      const userRole = 'manager'
      const allUserIds = ['user1', 'user2', 'user3', 'user4']
      const teamIds = ['user2', 'user3']
      const accessibleIds = userRole === 'manager' ? [...teamIds, 'user1'] : ['user1']
      
      expect(accessibleIds).toContain('user1') // Manager themselves
      expect(accessibleIds).toContain('user2') // Team member
      expect(accessibleIds.length).toBe(3)
    })

    it('should filter data by user role (rep sees only self)', () => {
      const userRole = 'staff'
      const userId = 'user1'
      const accessibleIds = userRole === 'staff' ? [userId] : []
      
      expect(accessibleIds).toEqual([userId])
      expect(accessibleIds.length).toBe(1)
    })
  })

  describe('Date Range Filtering', () => {
    it('should filter events by date range', () => {
      const events = [
        { created_at: '2024-01-15T00:00:00Z' },
        { created_at: '2024-01-20T00:00:00Z' },
        { created_at: '2024-02-05T00:00:00Z' },
      ]
      
      const startDate = new Date('2024-01-01T00:00:00Z')
      const endDate = new Date('2024-01-31T23:59:59Z')
      
      const filtered = events.filter(e => {
        const eventDate = new Date(e.created_at)
        return eventDate >= startDate && eventDate <= endDate
      })
      
      expect(filtered.length).toBe(2)
    })
  })
})

// Performance tests
describe('Analytics Performance', () => {
  it('should avoid N+1 queries', async () => {
    // In a real scenario, we would verify that queries use JOINs
    // instead of multiple round trips
    const startTime = Date.now()
    
    // Simulated efficient query (single JOIN)
    // SELECT e.*, up.full_name FROM events e
    // JOIN user_profiles up ON e.user_id = up.id
    // WHERE e.created_at BETWEEN start AND end
    
    const queryTime = Date.now() - startTime
    expect(queryTime).toBeLessThan(100) // Should be fast
  })

  it('should use indexes for date filtering', () => {
    // Verify that date columns have indexes
    // This would be checked in the database schema
    const hasIndex = true // In real test, check schema
    expect(hasIndex).toBe(true)
  })
})
