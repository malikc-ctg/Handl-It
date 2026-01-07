// Unified Automated Email Service
// Handles all automated emails: invoices, payments, jobs, bookings

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { emailType, recipientEmail, data } = await req.json()

    if (!emailType || !recipientEmail) {
      return new Response(
        JSON.stringify({ error: 'emailType and recipientEmail required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Generate email based on type
    const emailContent = await generateEmail(emailType, data, supabaseAdmin)
    
    if (!emailContent) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate email content' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send email via Resend
    const result = await sendEmail(
      recipientEmail,
      emailContent.subject,
      emailContent.html
    )

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Email error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Generate email content based on type
async function generateEmail(emailType: string, data: any, supabase: any) {
  switch (emailType) {
    case 'invoice_sent':
      return await generateInvoiceSentEmail(data, supabase)
    case 'payment_received':
      return await generatePaymentReceivedEmail(data, supabase)
    case 'payment_reminder':
      return await generatePaymentReminderEmail(data, supabase)
    case 'invoice_overdue':
      return await generateInvoiceOverdueEmail(data, supabase)
    case 'job_assigned':
      return await generateJobAssignedEmail(data, supabase)
    case 'job_completed':
      return await generateJobCompletedEmail(data, supabase)
    case 'booking_created':
      return await generateBookingCreatedEmail(data, supabase)
    default:
      return null
  }
}

// Invoice Sent Email
async function generateInvoiceSentEmail(data: any, supabase: any) {
  const invoice = data.invoice
  const client = data.client

  const html = createEmailTemplate({
    title: `Invoice #${invoice.invoice_number} from ${data.companyName || 'NFG'}`,
    greeting: `Hello ${client?.name || 'Valued Client'},`,
    message: `
      <p>We've sent you a new invoice for your records.</p>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px; color: #666;"><strong>Invoice #:</strong> ${invoice.invoice_number}</p>
        <p style="margin: 8px 0 0; font-size: 14px; color: #666;"><strong>Amount:</strong> $${parseFloat(invoice.total_amount).toFixed(2)}</p>
        <p style="margin: 8px 0 0; font-size: 14px; color: #666;"><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
      </div>
      <p>You can view this invoice online by clicking the button below.</p>
    `,
    ctaText: 'View Invoice',
    ctaLink: `${data.baseUrl || 'https://nfgone.ca'}/client-portal.html?invoice=${invoice.id}`,
    footer: 'Thank you for your business!'
  })

  return {
    subject: `Invoice #${invoice.invoice_number} - $${parseFloat(invoice.total_amount).toFixed(2)}`,
    html
  }
}

// Payment Received Email
async function generatePaymentReceivedEmail(data: any, supabase: any) {
  const payment = data.payment
  const invoice = data.invoice

  const html = createEmailTemplate({
    title: 'Payment Received - Thank You!',
    greeting: `Hello ${data.clientName || 'Valued Client'},`,
    message: `
      <p>We've received your payment. Thank you!</p>
      <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50;">
        <p style="margin: 0; font-size: 16px; color: #2e7d32;"><strong>Payment Amount:</strong> $${parseFloat(payment.amount).toFixed(2)}</p>
        <p style="margin: 8px 0 0; font-size: 14px; color: #666;"><strong>Invoice #:</strong> ${invoice?.invoice_number || 'N/A'}</p>
        <p style="margin: 8px 0 0; font-size: 14px; color: #666;"><strong>Payment Method:</strong> ${payment.payment_method || 'Credit Card'}</p>
        <p style="margin: 8px 0 0; font-size: 14px; color: #666;"><strong>Date:</strong> ${new Date(payment.payment_date).toLocaleDateString()}</p>
      </div>
      ${payment.receipt_url ? `<p><a href="${payment.receipt_url}" style="color: #0D47A1;">Download Receipt</a></p>` : ''}
    `,
    ctaText: 'View Invoice',
    ctaLink: `${data.baseUrl || 'https://nfgone.ca'}/client-portal.html?invoice=${invoice?.id}`,
    footer: 'We appreciate your prompt payment!'
  })

  return {
    subject: `Payment Received - $${parseFloat(payment.amount).toFixed(2)}`,
    html
  }
}

// Payment Reminder Email
async function generatePaymentReminderEmail(data: any, supabase: any) {
  const invoice = data.invoice

  const html = createEmailTemplate({
    title: 'Friendly Payment Reminder',
    greeting: `Hello ${data.clientName || 'Valued Client'},`,
    message: `
      <p>This is a friendly reminder that your invoice is due soon.</p>
      <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
        <p style="margin: 0; font-size: 16px; color: #e65100;"><strong>Invoice #:</strong> ${invoice.invoice_number}</p>
        <p style="margin: 8px 0 0; font-size: 14px; color: #666;"><strong>Amount Due:</strong> $${parseFloat(invoice.balance_due || invoice.total_amount).toFixed(2)}</p>
        <p style="margin: 8px 0 0; font-size: 14px; color: #666;"><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
      </div>
      <p>Please contact us if you have any questions or to arrange payment.</p>
    `,
    ctaText: 'View Invoice',
    ctaLink: `${data.baseUrl || 'https://nfgone.ca'}/client-portal.html?invoice=${invoice.id}`,
    footer: 'Thank you!'
  })

  return {
    subject: `Payment Reminder - Invoice #${invoice.invoice_number}`,
    html
  }
}

// Invoice Overdue Email
async function generateInvoiceOverdueEmail(data: any, supabase: any) {
  const invoice = data.invoice
  const daysOverdue = Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))

  const html = createEmailTemplate({
    title: 'Invoice Overdue - Action Required',
    greeting: `Hello ${data.clientName || 'Valued Client'},`,
    message: `
      <p>We noticed that your invoice payment is overdue.</p>
      <div style="background: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f44336;">
        <p style="margin: 0; font-size: 16px; color: #c62828;"><strong>Invoice #:</strong> ${invoice.invoice_number}</p>
        <p style="margin: 8px 0 0; font-size: 14px; color: #666;"><strong>Amount Due:</strong> $${parseFloat(invoice.balance_due || invoice.total_amount).toFixed(2)}</p>
        <p style="margin: 8px 0 0; font-size: 14px; color: #666;"><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
        <p style="margin: 8px 0 0; font-size: 14px; color: #c62828;"><strong>Days Overdue:</strong> ${daysOverdue}</p>
      </div>
      <p>Please contact us as soon as possible to arrange payment and avoid any service interruptions.</p>
    `,
    ctaText: 'View Invoice',
    ctaLink: `${data.baseUrl || 'https://nfgone.ca'}/client-portal.html?invoice=${invoice.id}`,
    footer: 'Please contact us if you have any questions about this invoice.'
  })

  return {
    subject: `URGENT: Invoice #${invoice.invoice_number} is Overdue`,
    html
  }
}

// Job Assigned Email
async function generateJobAssignedEmail(data: any, supabase: any) {
  const job = data.job
  const site = data.site

  const html = createEmailTemplate({
    title: 'New Job Assigned to You',
    greeting: `Hello ${data.workerName || 'Team Member'},`,
    message: `
      <p>You've been assigned a new job!</p>
      <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
        <p style="margin: 0; font-size: 16px; color: #1565c0;"><strong>Job:</strong> ${job.title}</p>
        <p style="margin: 8px 0 0; font-size: 14px; color: #666;"><strong>Site:</strong> ${site?.name || 'N/A'}</p>
        <p style="margin: 8px 0 0; font-size: 14px; color: #666;"><strong>Scheduled:</strong> ${new Date(job.scheduled_date).toLocaleDateString()}</p>
        ${job.priority === 'urgent' ? '<p style="margin: 8px 0 0; color: #c62828; font-weight: bold;">⚠️ URGENT</p>' : ''}
      </div>
      ${job.description ? `<p>${job.description}</p>` : ''}
    `,
    ctaText: 'View Job Details',
    ctaLink: `${data.baseUrl || 'https://nfgone.ca'}/jobs.html?job=${job.id}`,
    footer: 'Good luck with the job!'
  })

  return {
    subject: `New Job: ${job.title}`,
    html
  }
}

// Job Completed Email
async function generateJobCompletedEmail(data: any, supabase: any) {
  const job = data.job
  const client = data.client

  const html = createEmailTemplate({
    title: 'Job Completed',
    greeting: `Hello ${client?.name || 'Valued Client'},`,
    message: `
      <p>Great news! Your job has been completed.</p>
      <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50;">
        <p style="margin: 0; font-size: 16px; color: #2e7d32;"><strong>Job:</strong> ${job.title}</p>
        <p style="margin: 8px 0 0; font-size: 14px; color: #666;"><strong>Completed:</strong> ${new Date().toLocaleDateString()}</p>
        ${job.completed_by ? `<p style="margin: 8px 0 0; font-size: 14px; color: #666;"><strong>Completed By:</strong> ${job.completed_by}</p>` : ''}
      </div>
      <p>You can view photos and details of the completed work below.</p>
    `,
    ctaText: 'View Completed Job',
    ctaLink: `${data.baseUrl || 'https://nfgone.ca'}/jobs.html?job=${job.id}`,
    footer: 'Thank you for choosing NFG!'
  })

  return {
    subject: `Job Completed: ${job.title}`,
    html
  }
}

// Booking Created Email
async function generateBookingCreatedEmail(data: any, supabase: any) {
  const booking = data.booking
  const client = data.client

  const html = createEmailTemplate({
    title: 'Booking Confirmed',
    greeting: `Hello ${client?.name || 'Valued Client'},`,
    message: `
      <p>Your booking has been confirmed!</p>
      <div style="background: #f3e5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #9c27b0;">
        <p style="margin: 0; font-size: 16px; color: #6a1b9a;"><strong>Service:</strong> ${booking.title || 'Service Booking'}</p>
        <p style="margin: 8px 0 0; font-size: 14px; color: #666;"><strong>Scheduled:</strong> ${new Date(booking.scheduled_date).toLocaleDateString()}</p>
        ${booking.scheduled_time ? `<p style="margin: 8px 0 0; font-size: 14px; color: #666;"><strong>Time:</strong> ${booking.scheduled_time}</p>` : ''}
      </div>
      <p>We'll see you then!</p>
    `,
    ctaText: 'View Booking',
    ctaLink: `${data.baseUrl || 'https://nfgone.ca'}/bookings.html?booking=${booking.id}`,
    footer: 'We look forward to serving you!'
  })

  return {
    subject: `Booking Confirmed: ${booking.title || 'Service Booking'}`,
    html
  }
}

// Send email via Resend
async function sendEmail(to: string, subject: string, html: string) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'NFG <onboarding@resend.dev>'

  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [to],
      subject,
      html
    })
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'Failed to send email')
  }

  return { messageId: data.id }
}

// Create email template with NFG branding
function createEmailTemplate(options: {
  title: string
  greeting: string
  message: string
  ctaText?: string
  ctaLink?: string
  footer?: string
}) {
  // Platform logo (handl.it) - default for non-white-label companies
  const HANDL_IT_LOGO_URL = 'https://zqcbldgheimqrnqmbbed.supabase.co/storage/v1/object/sign/app-images/Untitled%20design.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xN2RmNDhlMi0xNGJlLTQ5NzMtODZlNy0zZTc0MjgzMWIzOTQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhcHAtaW1hZ2VzL1VudGl0bGVkIGRlc2lnbi5wbmciLCJpYXQiOjE3NjQ5NzExMTUsImV4cCI6NDg4NzAzNTExNX0.gLGPNDBFahGt3_dmWSFIny3YZbuU3eWBA86Gnu2Umpw'
  const NFG_LOGO_URL = 'https://zqcbldgheimqrnqmbbed.supabase.co/storage/v1/object/sign/app-images/NFG%20one.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xN2RmNDhlMi0xNGJlLTQ5NzMtODZlNy0zZTc0MjgzMWIzOTQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhcHAtaW1hZ2VzL05GRyBvbmUucG5nIiwiaWF0IjoxNzYyOTc5NzU5LCJleHAiOjQ4ODUwNDM3NTl9.fnJIDQep2yYlgGKlBRNnkrUoUzXzG7eac39GG6NQPuU'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.title)}</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #0D47A1 0%, #0A3A84 100%); padding: 40px 30px; text-align: center; }
    .logo { max-width: 250px; height: auto; margin-bottom: 20px; }
    .content { padding: 40px 30px; line-height: 1.6; color: #333333; }
    .greeting { font-size: 20px; font-weight: 600; color: #0D47A1; margin: 0 0 20px 0; }
    .message { font-size: 16px; color: #555555; }
    .button-container { text-align: center; margin: 35px 0; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #0D47A1 0%, #0A3A84 100%); color: #ffffff !important; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 700; box-shadow: 0 4px 14px rgba(13, 71, 161, 0.25); }
    .footer { background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef; }
    .footer-text { font-size: 13px; color: #6c757d; margin: 5px 0; }
  </style>
</head>
<body>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 0; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" class="email-container" style="max-width: 600px; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 12px; overflow: hidden;">
          <tr>
            <td class="header">
              <img src="${HANDL_IT_LOGO_URL}" alt="handl.it" class="logo" style="max-width: 250px; height: auto;">
            </td>
          </tr>
          <tr>
            <td class="content">
              <p class="greeting">${escapeHtml(options.greeting)}</p>
              <div class="message">${options.message}</div>
              ${options.ctaText && options.ctaLink ? `
              <div class="button-container">
                <a href="${options.ctaLink}" class="cta-button">${escapeHtml(options.ctaText)} →</a>
              </div>
              ` : ''}
              ${options.footer ? `<p style="margin-top: 30px; color: #666;">${escapeHtml(options.footer)}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td class="footer">
              <p class="footer-text" style="font-weight: 700; color: #0D47A1; font-size: 18px;">Northern Facilities Group</p>
              <p class="footer-text">Professional Facilities Management Solutions</p>
              <p class="footer-text" style="margin-top: 20px; font-size: 11px; color: #999999;">© 2025 Northern Facilities Group. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return String(text).replace(/[&<>"']/g, (m) => map[m])
}

