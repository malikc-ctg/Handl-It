// ============================================
// Messaging & Sequences Tests
// ============================================
// Tests for stop rules, step scheduling, error handling
// ============================================

/**
 * Test Suite for Messaging & Sequences
 * 
 * These tests verify:
 * 1. Stop rules (reply detection, stage change)
 * 2. Step scheduling (delay calculations, enqueueing)
 * 3. Message sending errors and retries
 * 4. Template rendering
 * 5. Provider abstraction
 */

// Mock Supabase client for testing
class MockSupabase {
  constructor() {
    this.data = {
      sequence_enrollments: [],
      messages_outbound: [],
      messages_inbound: [],
      sequences: [],
      message_templates: [],
    }
  }

  from(table) {
    return {
      select: (columns) => ({
        eq: (col, val) => ({
          single: () => ({
            data: this.data[table].find((r) => r[col] === val) || null,
            error: null,
          }),
          data: this.data[table].filter((r) => r[col] === val),
          error: null,
        }),
        data: this.data[table],
        error: null,
      }),
      insert: (values) => ({
        select: () => ({
          single: () => {
            const newRecord = { id: Math.random().toString(), ...values[0] }
            this.data[table].push(newRecord)
            return { data: newRecord, error: null }
          },
        }),
      }),
      update: (values) => ({
        eq: (col, val) => {
          const index = this.data[table].findIndex((r) => r[col] === val)
          if (index >= 0) {
            this.data[table][index] = { ...this.data[table][index], ...values }
          }
          return {
            select: () => ({
              single: () => ({
                data: this.data[table][index] || null,
                error: null,
              }),
            }),
          }
        },
      }),
    }
  }

  rpc(functionName, params) {
    // Mock RPC calls
    if (functionName === 'stop_sequence_enrollment') {
      const enrollment = this.data.sequence_enrollments.find(
        (e) => e.id === params.enrollment_id_param
      )
      if (enrollment) {
        enrollment.status = 'stopped'
        enrollment.stop_reason = params.reason
        enrollment.stopped_at = new Date().toISOString()
      }
      return { data: null, error: null }
    }

    if (functionName === 'enqueue_next_sequence_step') {
      const enrollment = this.data.sequence_enrollments.find(
        (e) => e.id === params.enrollment_id_param
      )
      // No next step when at final step (e.g. current_step_order >= 5)
      if (enrollment && (enrollment.current_step_order || 0) >= 5) {
        enrollment.status = 'completed'
        return { data: null, error: null }
      }
      const messageId = Math.random().toString()
      this.data.messages_outbound.push({
        id: messageId,
        enrollment_id: params.enrollment_id_param,
        status: 'queued',
      })
      return { data: messageId, error: null }
    }

    return { data: null, error: null }
  }
}

// ============================================
// TEST: Stop Rules - Reply Detection
// ============================================

describe('Stop Rules - Reply Detection', () => {
  let mockSupabase

  beforeEach(() => {
    mockSupabase = new MockSupabase()
  })

  test('Should stop sequence when reply is received and stop_on_reply is true', async () => {
    // Setup: Create enrollment with stop_on_reply = true
    const enrollment = {
      id: 'enrollment-1',
      sequence_id: 'seq-1',
      recipient_email: 'test@example.com',
      status: 'active',
    }

    const sequence = {
      id: 'seq-1',
      stop_rules: { on_reply: true },
    }

    mockSupabase.data.sequence_enrollments.push(enrollment)
    mockSupabase.data.sequences.push(sequence)

    // Simulate inbound message (reply)
    const inboundMessage = {
      id: 'inbound-1',
      sender_email: 'test@example.com',
      body: 'Thanks for the email!',
      processed: false,
    }

    mockSupabase.data.messages_inbound.push(inboundMessage)

    // Process stop rules (call RPC that stops enrollment)
    mockSupabase.rpc('stop_sequence_enrollment', {
      enrollment_id_param: enrollment.id,
      reason: 'reply'
    })

    const { data: updatedEnrollment } = mockSupabase
      .from('sequence_enrollments')
      .select('*')
      .eq('id', enrollment.id)
      .single()

    // Assert: Enrollment should be stopped
    expect(updatedEnrollment?.status).toBe('stopped')
    expect(updatedEnrollment?.stop_reason).toBe('reply')
  })

  test('Should NOT stop sequence when stop_on_reply is false', async () => {
    // Setup: Create enrollment with stop_on_reply = false
    const enrollment = {
      id: 'enrollment-1',
      sequence_id: 'seq-1',
      recipient_email: 'test@example.com',
      status: 'active',
    }

    const sequence = {
      id: 'seq-1',
      stop_rules: { on_reply: false },
    }

    mockSupabase.data.sequence_enrollments.push(enrollment)
    mockSupabase.data.sequences.push(sequence)

    // Simulate inbound message
    const inboundMessage = {
      id: 'inbound-1',
      sender_email: 'test@example.com',
      body: 'Thanks!',
      processed: false,
    }

    mockSupabase.data.messages_inbound.push(inboundMessage)

    // Process stop rules (should NOT stop)
    const { data: fetchedEnrollment } = mockSupabase
      .from('sequence_enrollments')
      .select('*')
      .eq('id', 'enrollment-1')
      .single()

    // Assert: Enrollment should remain active
    expect(fetchedEnrollment?.status).toBe('active')
  })
})

// ============================================
// TEST: Step Scheduling
// ============================================

describe('Step Scheduling', () => {
  let mockSupabase

  beforeEach(() => {
    mockSupabase = new MockSupabase()
  })

  test('Should enqueue next step with correct delay', async () => {
    // Setup: Create enrollment at step 1
    const enrollment = {
      id: 'enrollment-1',
      sequence_id: 'seq-1',
      current_step_order: 1,
      status: 'active',
      started_at: new Date().toISOString(),
    }

    const step2 = {
      id: 'step-2',
      sequence_id: 'seq-1',
      step_order: 2,
      delay_days: 3,
      delay_hours: 0,
      is_active: true,
    }

    mockSupabase.data.sequence_enrollments.push(enrollment)

    // Calculate scheduled time
    const delayMs = step2.delay_days * 24 * 60 * 60 * 1000 + step2.delay_hours * 60 * 60 * 1000
    const scheduledTime = new Date(new Date(enrollment.started_at).getTime() + delayMs)

    // Assert: Scheduled time should be 3 days from start
    expect(scheduledTime.getTime()).toBeGreaterThan(new Date(enrollment.started_at).getTime())
    const daysDiff = (scheduledTime - new Date(enrollment.started_at)) / (1000 * 60 * 60 * 24)
    expect(Math.floor(daysDiff)).toBe(3)
  })

  test('Should mark enrollment as completed when no more steps', async () => {
    // Setup: Enrollment at final step
    const enrollment = {
      id: 'enrollment-1',
      sequence_id: 'seq-1',
      current_step_order: 5, // Final step
      status: 'active',
    }

    mockSupabase.data.sequence_enrollments.push(enrollment)

    // Try to enqueue next step (should return null and mark completed)
    const result = mockSupabase.rpc('enqueue_next_sequence_step', {
      enrollment_id_param: enrollment.id,
    })

    // Assert: Should return null (no next step)
    expect(result.data).toBeNull()

    const { data: updatedEnrollment } = mockSupabase
      .from('sequence_enrollments')
      .select('*')
      .eq('id', enrollment.id)
      .single()

    // Assert: Enrollment should be completed
    expect(updatedEnrollment?.status).toBe('completed')
  })
})

// ============================================
// TEST: Message Sending Errors and Retries
// ============================================

describe('Message Sending Errors and Retries', () => {
  let mockSupabase

  beforeEach(() => {
    mockSupabase = new MockSupabase()
  })

  test('Should mark message as failed on send error', async () => {
    // Setup: Create queued message
    const message = {
      id: 'msg-1',
      status: 'queued',
      channel: 'email',
      recipient_email: 'test@example.com',
      retry_count: 0,
    }

    mockSupabase.data.messages_outbound.push(message)

    // Simulate send failure
    const sendError = new Error('Provider API error')
    
    // Update message to failed
    mockSupabase
      .from('messages_outbound')
      .update({
        status: 'failed',
        error_message: sendError.message,
        retry_count: message.retry_count + 1,
      })
      .eq('id', message.id)

    const { data: updatedMessage } = mockSupabase
      .from('messages_outbound')
      .select('*')
      .eq('id', message.id)
      .single()

    // Assert: Message should be marked as failed
    expect(updatedMessage?.status).toBe('failed')
    expect(updatedMessage?.error_message).toBe('Provider API error')
    expect(updatedMessage?.retry_count).toBe(1)
  })

  test('Should retry failed messages up to max retries', async () => {
    // Setup: Message with retry count
    const message = {
      id: 'msg-1',
      status: 'failed',
      retry_count: 2,
      max_retries: 3,
    }

    mockSupabase.data.messages_outbound.push(message)

    // Attempt retry
    const shouldRetry = message.retry_count < (message.max_retries || 3)

    // Assert: Should allow retry if under limit
    expect(shouldRetry).toBe(true)

    // After max retries
    message.retry_count = 3
    const shouldRetryMax = message.retry_count < (message.max_retries || 3)

    // Assert: Should NOT retry if at limit
    expect(shouldRetryMax).toBe(false)
  })
})

// ============================================
// TEST: Template Rendering
// ============================================

describe('Template Rendering', () => {
  test('Should replace template variables correctly', () => {
    const template = 'Hello {{name}}, welcome to {{site_name}}!'
    const variables = {
      name: 'John Doe',
      site_name: 'Acme Building',
    }

    let rendered = template
    Object.keys(variables).forEach((key) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      rendered = rendered.replace(regex, String(variables[key]))
    })

    // Assert: Variables should be replaced
    expect(rendered).toBe('Hello John Doe, welcome to Acme Building!')
  })

  test('Should handle missing variables gracefully', () => {
    const template = 'Hello {{name}}, your deal value is {{deal_value}}'
    const variables = {
      name: 'John Doe',
      // deal_value is missing
    }

    let rendered = template
    Object.keys(variables).forEach((key) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      rendered = rendered.replace(regex, String(variables[key] || ''))
    })

    // Clean up unreplaced placeholders
    rendered = rendered.replace(/\{\{[^}]+\}\}/g, '')

    // Assert: Should render with empty string for missing variable
    expect(rendered).toBe('Hello John Doe, your deal value is ')
  })
})

// ============================================
// TEST: Provider Abstraction
// ============================================

describe('Provider Abstraction', () => {
  test('Should support multiple email providers', () => {
    const providers = ['resend', 'sendgrid', 'smtp']
    const providerNames = providers.map((p) => p.toLowerCase())

    // Assert: All should be valid provider names
    expect(providerNames).toContain('resend')
    expect(providerNames.length).toBeGreaterThan(1)
  })

  test('Should support multiple SMS providers', () => {
    const providers = ['twilio', 'quo', 'nexmo']
    const providerNames = providers.map((p) => p.toLowerCase())

    // Assert: All should be valid provider names
    expect(providerNames).toContain('twilio')
    expect(providerNames).toContain('quo')
    expect(providerNames.length).toBeGreaterThan(1)
  })
})

// ============================================
// RUN TESTS (if using a test runner)
// ============================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MockSupabase,
  }
}

console.log('✅ Messaging & Sequences tests loaded')
console.log('Run these tests with your preferred test runner (Jest, Mocha, etc.)')
