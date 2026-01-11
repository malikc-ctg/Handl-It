// ============================================
// Receive Inbound Message Edge Function
// ============================================
// Handles inbound messages from providers (Twilio, Quo, etc.)
// Records messages and triggers stop rule processing
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InboundWebhook {
  provider: 'twilio' | 'quo' | 'resend'
  channel: 'email' | 'sms'
  sender_email?: string
  sender_phone?: string
  sender_name?: string
  recipient_email?: string
  recipient_phone?: string
  subject?: string
  body: string
  provider_message_id?: string
  raw_data?: any
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse webhook based on provider
    let webhookData: InboundWebhook

    // Check headers to determine provider
    const userAgent = req.headers.get('user-agent') || ''
    const contentType = req.headers.get('content-type') || ''

    if (userAgent.includes('Twilio') || contentType.includes('application/x-www-form-urlencoded')) {
      // Twilio webhook
      const formData = await req.formData()
      webhookData = {
        provider: 'twilio',
        channel: 'sms',
        sender_phone: formData.get('From') as string,
        recipient_phone: formData.get('To') as string,
        body: formData.get('Body') as string,
        provider_message_id: formData.get('MessageSid') as string,
        raw_data: Object.fromEntries(formData),
      }
    } else {
      // Generic JSON webhook (Quo, custom, etc.)
      const body = await req.json()

      // Determine provider from body or headers
      if (body.provider === 'quo' || req.headers.get('x-quo-signature')) {
        webhookData = {
          provider: 'quo',
          channel: body.channel || 'sms',
          sender_phone: body.from || body.sender_phone,
          sender_email: body.from_email || body.sender_email,
          recipient_phone: body.to || body.recipient_phone,
          recipient_email: body.to_email || body.recipient_email,
          subject: body.subject,
          body: body.message || body.body || body.text,
          provider_message_id: body.id || body.message_id,
          raw_data: body,
        }
      } else {
        // Generic format
        webhookData = {
          provider: body.provider || 'quo',
          channel: body.channel || 'sms',
          sender_phone: body.from || body.sender_phone,
          sender_email: body.from_email || body.sender_email,
          recipient_phone: body.to || body.recipient_phone,
          recipient_email: body.to_email || body.recipient_email,
          subject: body.subject,
          body: body.message || body.body || body.text,
          provider_message_id: body.id || body.message_id,
          raw_data: body,
        }
      }
    }

    if (!webhookData.body) {
      return new Response(
        JSON.stringify({ error: 'Message body required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get provider ID
    const { data: provider } = await supabaseAdmin
      .from('message_providers')
      .select('id')
      .eq('name', webhookData.provider)
      .eq('type', webhookData.channel)
      .single()

    // Record inbound message
    const { data: inboundMessage, error: insertError } = await supabaseAdmin
      .from('messages_inbound')
      .insert({
        channel: webhookData.channel,
        provider_id: provider?.id || null,
        sender_email: webhookData.sender_email,
        sender_phone: webhookData.sender_phone,
        sender_name: webhookData.sender_name,
        recipient_email: webhookData.recipient_email,
        recipient_phone: webhookData.recipient_phone,
        subject: webhookData.subject,
        body: webhookData.body,
        provider_message_id: webhookData.provider_message_id,
        raw_data: webhookData.raw_data || {},
        processed: false,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error recording inbound message:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to record message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Try to match to an enrollment
    let matchedEnrollmentId: string | null = null

    if (webhookData.sender_email || webhookData.sender_phone) {
      const { data: enrollment } = await supabaseAdmin
        .from('sequence_enrollments')
        .select('id')
        .eq('status', 'active')
        .or(
          `recipient_email.eq.${webhookData.sender_email || ''},recipient_phone.eq.${webhookData.sender_phone || ''}`
        )
        .order('started_at', { ascending: false })
        .limit(1)
        .single()

      if (enrollment) {
        matchedEnrollmentId = enrollment.id

        // Update inbound message with match
        await supabaseAdmin
          .from('messages_inbound')
          .update({ matched_enrollment_id: enrollment.id })
          .eq('id', inboundMessage.id)
      }
    }

    // Trigger stop rule processing (async - don't wait)
    // The cron job will process this
    supabaseAdmin.rpc('process_inbound_for_stop_rules').catch((err) => {
      console.error('Error processing stop rules:', err)
    })

    return new Response(
      JSON.stringify({
        success: true,
        messageId: inboundMessage.id,
        matchedEnrollmentId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error receiving inbound message:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
