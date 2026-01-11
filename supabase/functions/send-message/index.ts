// ============================================
// Send Message Edge Function
// ============================================
// Handles sending queued messages via provider abstraction
// Supports email (Resend) and SMS (Twilio/Quo)
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MessageProvider {
  id: string
  name: string
  type: 'email' | 'sms'
  config: any
}

interface OutboundMessage {
  id: string
  channel: 'email' | 'sms'
  provider_id: string
  recipient_email?: string
  recipient_phone?: string
  recipient_name?: string
  subject?: string
  body: string
  template_id?: string
  enrollment_id?: string
  scheduled_for?: string
}

// ============================================
// PROVIDER ABSTRACTION LAYER
// ============================================

interface EmailProvider {
  send(params: {
    to: string
    from: string
    subject: string
    html: string
  }): Promise<{ messageId: string; provider: string }>
}

interface SMSProvider {
  send(params: {
    to: string
    from: string
    body: string
  }): Promise<{ messageId: string; provider: string }>
}

// Resend Email Provider
class ResendEmailProvider implements EmailProvider {
  constructor(private apiKey: string, private fromEmail: string) {}

  async send(params: { to: string; from: string; subject: string; html: string }) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.from || this.fromEmail,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send email via Resend')
    }

    return {
      messageId: data.id,
      provider: 'resend',
    }
  }
}

// Twilio SMS Provider
class TwilioSMSProvider implements SMSProvider {
  constructor(
    private accountSid: string,
    private authToken: string,
    private fromNumber: string
  ) {}

  async send(params: { to: string; from: string; body: string }) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`
    
    const formData = new URLSearchParams({
      To: params.to,
      From: params.from || this.fromNumber,
      Body: params.body,
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${this.accountSid}:${this.authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send SMS via Twilio')
    }

    return {
      messageId: data.sid,
      provider: 'twilio',
    }
  }
}

// Quo SMS Provider (abstraction - adjust API as needed)
class QuoSMSProvider implements SMSProvider {
  constructor(private apiKey: string, private fromNumber: string) {}

  async send(params: { to: string; from: string; body: string }) {
    // Quo API integration - adjust endpoint/format based on actual API
    const response = await fetch('https://api.quo.com/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: params.to,
        from: params.from || this.fromNumber,
        message: params.body,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send SMS via Quo')
    }

    return {
      messageId: data.id || data.message_id,
      provider: 'quo',
    }
  }
}

// Provider factory
async function getProvider(
  providerConfig: MessageProvider,
  supabase: any
): Promise<EmailProvider | SMSProvider> {
  const { name, type, config } = providerConfig

  if (type === 'email') {
    if (name === 'resend') {
      const apiKey = config.api_key || Deno.env.get('RESEND_API_KEY')
      const fromEmail = config.from_email || Deno.env.get('RESEND_FROM_EMAIL') || 'NFG <onboarding@resend.dev>'
      
      if (!apiKey) {
        throw new Error('Resend API key not configured')
      }
      
      return new ResendEmailProvider(apiKey, fromEmail)
    }
    
    throw new Error(`Unsupported email provider: ${name}`)
  }

  if (type === 'sms') {
    if (name === 'twilio') {
      const accountSid = config.account_sid || Deno.env.get('TWILIO_ACCOUNT_SID')
      const authToken = config.auth_token || Deno.env.get('TWILIO_AUTH_TOKEN')
      const fromNumber = config.from_number || Deno.env.get('TWILIO_FROM_NUMBER')
      
      if (!accountSid || !authToken || !fromNumber) {
        throw new Error('Twilio credentials not configured')
      }
      
      return new TwilioSMSProvider(accountSid, authToken, fromNumber)
    }
    
    if (name === 'quo') {
      const apiKey = config.api_key || Deno.env.get('QUO_API_KEY')
      const fromNumber = config.from_number || Deno.env.get('QUO_FROM_NUMBER')
      
      if (!apiKey || !fromNumber) {
        throw new Error('Quo credentials not configured')
      }
      
      return new QuoSMSProvider(apiKey, fromNumber)
    }
    
    throw new Error(`Unsupported SMS provider: ${name}`)
  }

  throw new Error(`Unsupported provider type: ${type}`)
}

// ============================================
// TEMPLATE RENDERING
// ============================================

function renderTemplate(template: string, variables: Record<string, any>): string {
  let rendered = template
  
  // Replace {{variable}} placeholders
  Object.keys(variables).forEach((key) => {
    const value = variables[key] || ''
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    rendered = rendered.replace(regex, String(value))
  })
  
  // Clean up any unreplaced placeholders
  rendered = rendered.replace(/\{\{[^}]+\}\}/g, '')
  
  return rendered
}

async function getTemplateVariables(
  message: OutboundMessage,
  supabase: any
): Promise<Record<string, any>> {
  const variables: Record<string, any> = {
    name: message.recipient_name || '',
    recipient_name: message.recipient_name || '',
  }

  // If message is part of an enrollment, fetch entity data
  if (message.enrollment_id) {
    const { data: enrollment } = await supabase
      .from('sequence_enrollments')
      .select('entity_type, entity_id, metadata')
      .eq('id', message.enrollment_id)
      .single()

    if (enrollment) {
      variables.entity_type = enrollment.entity_type
      variables.entity_id = enrollment.entity_id

      // Fetch entity-specific data
      if (enrollment.entity_type === 'site') {
        const { data: site } = await supabase
          .from('sites')
          .select('name, address, deal_value, contact_email, contact_phone')
          .eq('id', enrollment.entity_id)
          .single()

        if (site) {
          variables.site_name = site.name
          variables.deal_value = site.deal_value
          variables.site_address = site.address
        }
      } else if (enrollment.entity_type === 'booking') {
        const { data: booking } = await supabase
          .from('bookings')
          .select('title, scheduled_date, description')
          .eq('id', enrollment.entity_id)
          .single()

        if (booking) {
          variables.booking_title = booking.title
          variables.booking_date = booking.scheduled_date
        }
      }

      // Merge metadata variables
      if (enrollment.metadata && typeof enrollment.metadata === 'object') {
        Object.assign(variables, enrollment.metadata)
      }
    }
  }

  return variables
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
  let messageId: string | undefined

  try {
    const body = await req.json()
    messageId = body.messageId

    if (!messageId) {
      return new Response(
        JSON.stringify({ error: 'messageId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get message
    const { data: message, error: messageError } = await supabaseAdmin
      .from('messages_outbound')
      .select('*')
      .eq('id', messageId)
      .single()

    if (messageError || !message) {
      return new Response(
        JSON.stringify({ error: 'Message not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if message should be sent now
    if (message.scheduled_for && new Date(message.scheduled_for) > new Date()) {
      return new Response(
        JSON.stringify({ success: true, message: 'Message scheduled for later' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if already sent
    if (message.status === 'sent' || message.status === 'delivered' || message.status === 'replied') {
      return new Response(
        JSON.stringify({ success: true, message: 'Message already sent' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update status to sending
    await supabaseAdmin
      .from('messages_outbound')
      .update({ status: 'sending', updated_at: new Date().toISOString() })
      .eq('id', messageId)

    // Get provider
    const { data: provider, error: providerError } = await supabaseAdmin
      .from('message_providers')
      .select('*')
      .eq('id', message.provider_id)
      .single()

    if (providerError || !provider) {
      throw new Error('Provider not found')
    }

    // Get template variables and render
    const variables = await getTemplateVariables(message as OutboundMessage, supabaseAdmin)
    const renderedBody = message.template_id
      ? renderTemplate(message.body, variables)
      : message.body
    const renderedSubject = message.subject
      ? renderTemplate(message.subject, variables)
      : message.subject

    // Get provider instance
    const providerInstance = await getProvider(provider as MessageProvider, supabaseAdmin)

    let result: { messageId: string; provider: string }

    // Send message
    if (message.channel === 'email') {
      const emailProvider = providerInstance as EmailProvider
      
      if (!message.recipient_email) {
        throw new Error('Recipient email required for email messages')
      }

      result = await emailProvider.send({
        to: message.recipient_email,
        from: provider.config.from_email || Deno.env.get('RESEND_FROM_EMAIL') || 'NFG <onboarding@resend.dev>',
        subject: renderedSubject || 'Message from NFG',
        html: renderedBody,
      })
    } else if (message.channel === 'sms') {
      const smsProvider = providerInstance as SMSProvider
      
      if (!message.recipient_phone) {
        throw new Error('Recipient phone required for SMS messages')
      }

      result = await smsProvider.send({
        to: message.recipient_phone,
        from: provider.config.from_number || '',
        body: renderedBody,
      })
    } else {
      throw new Error(`Unsupported channel: ${message.channel}`)
    }

    // Update message status
    await supabaseAdmin
      .from('messages_outbound')
      .update({
        status: 'sent',
        provider_message_id: result.messageId,
        provider_response: result,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)

    // Create audit log entry
    await supabaseAdmin
      .from('message_audit_log')
      .insert({
        message_id: messageId,
        action: 'sent',
        details: {
          provider: result.provider,
          provider_message_id: result.messageId,
          channel: message.channel,
        },
      })

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
        provider: result.provider,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error sending message:', error)

    // Update message status to failed if we have messageId
    if (messageId) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        await supabaseAdmin
          .from('messages_outbound')
          .update({
            status: 'failed',
            error_message: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', messageId)

        // Log audit
        await supabaseAdmin
          .from('message_audit_log')
          .insert({
            message_id: messageId,
            action: 'failed',
            details: { error: error.message },
          })
      } catch (logError) {
        console.error('Error logging failure:', logError)
      }
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
