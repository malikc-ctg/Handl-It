/**
 * Quo Webhook Handler
 * Processes incoming webhooks from Quo call tracking system
 * Implements idempotency and automatic linking to sites/leads
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface QuoWebhookPayload {
  event_type: string
  call_id: string
  contact_id?: string
  direction: 'inbound' | 'outbound'
  outcome: 'answered' | 'missed' | 'voicemail' | 'busy' | 'failed' | 'no_answer' | 'cancelled'
  from_number: string
  to_number: string
  started_at?: string
  answered_at?: string
  ended_at?: string
  duration_seconds?: number
  has_consent?: boolean
  transcript?: string
  recording_url?: string
  signature?: string
}

interface StructuredLog {
  level: 'info' | 'warn' | 'error'
  message: string
  event_type: string
  call_id?: string
  contact_id?: string
  timestamp: string
  metadata?: Record<string, unknown>
}

function createStructuredLog(
  level: StructuredLog['level'],
  message: string,
  metadata?: Record<string, unknown>
): StructuredLog {
  return {
    level,
    message,
    event_type: metadata?.event_type as string || 'unknown',
    call_id: metadata?.call_id as string,
    contact_id: metadata?.contact_id as string,
    timestamp: new Date().toISOString(),
    metadata
  }
}

function logStructured(log: StructuredLog) {
  console.log(JSON.stringify(log))
}

// Normalize phone number to E.164 format
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '')
  
  // If doesn't start with +, assume US number and add +1
  if (!cleaned.startsWith('+')) {
    const digits = cleaned.replace(/\D/g, '')
    if (digits.length === 10) {
      return `+1${digits}`
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`
    }
  }
  
  return cleaned
}

// Sync call to Priority Actions: update deal + contact + sales_activities
async function syncCallToPriorityActions(
  supabase: any,
  siteId: number,
  payload: QuoWebhookPayload,
  call: { id: string; ended_at?: string | null; started_at?: string | null }
): Promise<void> {
  const answered = payload.outcome === 'answered'
  const activityDate = payload.ended_at || payload.started_at || new Date().toISOString()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)
  const tomorrowIso = tomorrow.toISOString()

  const { data: deals, error: dealsError } = await supabase
    .from('deals')
    .select('id, primary_contact_id, company_id, assigned_user_id, assigned_to, stage')
    .eq('site_id', siteId)

  if (dealsError || !deals?.length) return

  const closedStages = ['won', 'lost', 'closed_won', 'closed_lost']
  const openDeals = (deals as any[]).filter(
    (d) => !closedStages.includes(d.stage) && !String(d.stage || '').toLowerCase().includes('closed')
  )
  if (openDeals.length === 0) return

  for (const deal of openDeals) {
    const dealId = deal.id
    const companyId = deal.company_id || null
    const assignedUserId = deal.assigned_user_id || deal.assigned_to || null
    const contactId = deal.primary_contact_id || null

    await supabase
      .from('deals')
      .update({
        last_touch_at: new Date().toISOString(),
        ...(answered ? {} : { next_action_type: 'callback', next_action_date: tomorrowIso }),
        updated_at: new Date().toISOString()
      })
      .eq('id', dealId)

    if (contactId) {
      const { data: contact } = await supabase.from('contacts').select('no_contact_streak, total_contact_attempts').eq('id', contactId).single()
      const currentStreak = (contact?.no_contact_streak ?? 0) as number
      const newStreak = answered ? 0 : Math.min(2, currentStreak + 1)
      const totalAttempts = ((contact as any)?.total_contact_attempts ?? 0) + 1
      await supabase
        .from('contacts')
        .update({
          last_contact_attempt_at: new Date().toISOString(),
          total_contact_attempts: totalAttempts,
          ...(answered
            ? { last_contacted_at: new Date().toISOString(), no_contact_streak: 0 }
            : { no_contact_streak: newStreak, next_follow_up_date: tomorrowIso, next_follow_up_type: 'call' }),
          updated_at: new Date().toISOString()
        })
        .eq('id', contactId)
    }

    const activityRow: Record<string, unknown> = {
      company_id: companyId,
      deal_id: dealId,
      contact_id: contactId,
      assigned_user_id: assignedUserId,
      activity_type: 'call',
      outcome: answered ? 'contact_made' : 'no_contact',
      activity_date: activityDate,
      created_by: assignedUserId,
      updated_at: new Date().toISOString()
    }
    if (payload.duration_seconds != null) {
      activityRow.duration_minutes = Math.round(payload.duration_seconds / 60)
    }
    if (!answered) {
      activityRow.next_action_date = tomorrowIso
      activityRow.next_action_type = 'callback'
    }
    await supabase.from('sales_activities').insert(activityRow)
  }
}

// Find site by phone number match
async function findSiteByPhone(supabase: any, phoneNumber: string): Promise<number | null> {
  const normalized = normalizePhoneNumber(phoneNumber)
  
  // Try exact match on contact_phone
  const { data: sites } = await supabase
    .from('sites')
    .select('id, contact_phone')
    .or(`contact_phone.eq.${normalized},contact_phone.eq.${phoneNumber}`)
    .limit(1)
  
  if (sites && sites.length > 0) {
    return sites[0].id
  }
  
  // Try matching via quo_contact_mappings
  const { data: mappings } = await supabase
    .from('quo_contact_mappings')
    .select('site_id')
    .eq('phone_number', normalized)
    .limit(1)
  
  if (mappings && mappings.length > 0) {
    return mappings[0].site_id
  }
  
  return null
}

// Process call webhook with idempotency
async function processCallWebhook(
  supabase: any,
  payload: QuoWebhookPayload
): Promise<{ success: boolean; call_id?: string; error?: string }> {
  const webhookId = payload.call_id || `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  logStructured(createStructuredLog('info', 'Processing call webhook', {
    event_type: payload.event_type,
    call_id: webhookId,
    contact_id: payload.contact_id
  }))
  
  // Step 1: Log webhook for idempotency check
  const { data: existingLog, error: logCheckError } = await supabase
    .from('quo_webhook_logs')
    .select('id, processed, processing_error')
    .eq('webhook_id', webhookId)
    .single()
  
  if (existingLog) {
    if (existingLog.processed) {
      logStructured(createStructuredLog('info', 'Webhook already processed (idempotency)', {
        event_type: payload.event_type,
        call_id: webhookId,
        webhook_log_id: existingLog.id
      }))
      return { success: true, call_id: existingLog.id }
    }
    
    if (existingLog.processing_error) {
      logStructured(createStructuredLog('warn', 'Retrying previously failed webhook', {
        event_type: payload.event_type,
        call_id: webhookId,
        previous_error: existingLog.processing_error
      }))
    }
  }
  
  // Step 2: Insert or update webhook log
  const { data: webhookLog, error: logError } = await supabase
    .from('quo_webhook_logs')
    .upsert({
      webhook_id: webhookId,
      event_type: payload.event_type,
      payload: payload as any,
      signature: payload.signature,
      processed: false
    }, {
      onConflict: 'webhook_id'
    })
    .select()
    .single()
  
  if (logError) {
    logStructured(createStructuredLog('error', 'Failed to log webhook', {
      event_type: payload.event_type,
      call_id: webhookId,
      error: logError.message
    }))
    return { success: false, error: logError.message }
  }
  
  try {
    // Step 3: Find or create contact mapping
    let siteId: number | null = null
    
    if (payload.contact_id) {
      const { data: mapping } = await supabase
        .from('quo_contact_mappings')
        .select('site_id')
        .eq('quo_contact_id', payload.contact_id)
        .single()
      
      if (mapping) {
        siteId = mapping.site_id
        logStructured(createStructuredLog('info', 'Found site via contact mapping', {
          call_id: webhookId,
          contact_id: payload.contact_id,
          site_id: siteId
        }))
      }
    }
    
    // Step 4: Try phone number matching if no contact mapping
    if (!siteId) {
      siteId = await findSiteByPhone(supabase, payload.from_number)
      if (siteId) {
        logStructured(createStructuredLog('info', 'Found site via phone match', {
          call_id: webhookId,
          phone: payload.from_number,
          site_id: siteId
        }))
      }
    }
    
    // Step 5: Create or update call record
    const callData = {
      quo_call_id: webhookId,
      quo_contact_id: payload.contact_id || null,
      direction: payload.direction,
      outcome: payload.outcome,
      status: payload.outcome === 'answered' ? 'completed' : 'failed',
      from_number: normalizePhoneNumber(payload.from_number),
      to_number: normalizePhoneNumber(payload.to_number),
      from_number_raw: payload.from_number,
      to_number_raw: payload.to_number,
      started_at: payload.started_at || null,
      answered_at: payload.answered_at || null,
      ended_at: payload.ended_at || null,
      duration_seconds: payload.duration_seconds || null,
      site_id: siteId,
      linked_by: siteId ? (payload.contact_id ? 'quo_contact' : 'phone_match') : null,
      has_consent: payload.has_consent || false,
      transcript: payload.has_consent ? (payload.transcript || null) : null,
      recording_url: payload.has_consent ? (payload.recording_url || null) : null,
      raw_webhook_payload: payload as any
    }
    
    const { data: call, error: callError } = await supabase
      .from('calls')
      .upsert(callData, {
        onConflict: 'quo_call_id'
      })
      .select()
      .single()
    
    if (callError) {
      throw callError
    }
    
    // Step 6: Create contact mapping if we have contact_id and site_id
    if (payload.contact_id && siteId) {
      await supabase
        .from('quo_contact_mappings')
        .upsert({
          quo_contact_id: payload.contact_id,
          site_id: siteId,
          phone_number: normalizePhoneNumber(payload.from_number),
          metadata: { auto_mapped: true, mapped_at: new Date().toISOString() }
        }, {
          onConflict: 'quo_contact_id'
        })
    }
    
    // Step 7: Mark webhook as processed
    await supabase
      .from('quo_webhook_logs')
      .update({ processed: true })
      .eq('id', webhookLog.id)
    
    // Step 8: Sync to Priority Actions (deal + contact + sales_activities)
    if (siteId && payload.outcome) {
      try {
        await syncCallToPriorityActions(supabase, siteId, payload, call)
      } catch (syncErr: any) {
        logStructured(createStructuredLog('warn', 'Priority Actions sync failed (call still recorded)', {
          event_type: payload.event_type,
          call_id: webhookId,
          site_id: siteId,
          error: syncErr?.message
        }))
      }
    }
    
    logStructured(createStructuredLog('info', 'Webhook processed successfully', {
      event_type: payload.event_type,
      call_id: call.id,
      webhook_id: webhookId,
      site_id: siteId
    }))
    
    return { success: true, call_id: call.id }
  } catch (error: any) {
    // Mark webhook as failed
    await supabase
      .from('quo_webhook_logs')
      .update({
        processed: false,
        processing_error: error.message
      })
      .eq('id', webhookLog.id)
    
    logStructured(createStructuredLog('error', 'Webhook processing failed', {
      event_type: payload.event_type,
      call_id: webhookId,
      error: error.message,
      stack: error.stack
    }))
    
    return { success: false, error: error.message }
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    const payload: QuoWebhookPayload = await req.json()
    
    // Verify webhook signature if secret is configured
    const webhookSecret = Deno.env.get('QUO_WEBHOOK_SECRET')
    if (webhookSecret && payload.signature) {
      // Implement signature verification here
      // For now, we'll log a warning if signature is provided but not verified
      logStructured(createStructuredLog('warn', 'Webhook signature verification not implemented', {
        event_type: payload.event_type
      }))
    }
    
    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // Process webhook
    const result = await processCallWebhook(supabaseAdmin, payload)
    
    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ success: true, call_id: result.call_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    logStructured(createStructuredLog('error', 'Webhook handler error', {
      error: error.message,
      stack: error.stack
    }))
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
