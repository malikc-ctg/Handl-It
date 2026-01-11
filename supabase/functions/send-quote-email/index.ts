import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Resend API key from environment
    const RESEND_API_KEY = Deno.env.get('resend_api_key') || Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      throw new Error('resend_api_key is not set. Please set it in Supabase secrets.')
    }

    // Get request body
    const { quoteId, revisionNumber, emails, publicToken, quoteType, revisionType, siteName, contactName } = await req.json()

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      throw new Error('At least one email address is required')
    }

    // Build the quote portal URL
    const baseUrl = Deno.env.get('quote_portal_url') || 
                    Deno.env.get('QUOTE_PORTAL_URL') || 
                    'https://your-domain.com'
    const quoteUrl = `${baseUrl}/quote.html?token=${publicToken}`

    // Determine email subject and content based on quote type
    const isWalkthroughProposal = revisionType === 'walkthrough_proposal'
    const subject = isWalkthroughProposal
      ? `Walkthrough Proposal - ${siteName || 'Commercial Cleaning Quote'}`
      : `Your Commercial Cleaning Quote - ${siteName || 'NFG Facilities'}`

    // Create email HTML template
    const emailHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NFG Quote</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f7fa;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #0D47A1 0%, #0A3A84 100%);
      padding: 40px 30px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 40px 30px;
      line-height: 1.6;
      color: #333333;
    }
    .greeting {
      font-size: 20px;
      font-weight: 600;
      color: #0D47A1;
      margin: 0 0 20px 0;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #0D47A1 0%, #0A3A84 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 700;
      margin: 20px 0;
      box-shadow: 0 4px 14px rgba(13, 71, 161, 0.25);
    }
    .info-box {
      background: #fff9e6;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .footer {
      background: #f8f9fa;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e9ecef;
      font-size: 13px;
      color: #6c757d;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>${isWalkthroughProposal ? 'Walkthrough Proposal' : 'Commercial Cleaning Quote'}</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Northern Facilities Group</p>
    </div>
    <div class="content">
      <p class="greeting">Hello${contactName ? ` ${contactName}` : ''}!</p>
      
      <p>We're excited to share ${isWalkthroughProposal ? 'a walkthrough proposal' : 'your customized quote'} for commercial cleaning services${siteName ? ` at ${siteName}` : ''}.</p>
      
      ${isWalkthroughProposal ? `
      <p>This walkthrough proposal outlines our recommended scope of work. To provide you with a final, binding quote, we'd like to schedule a site walkthrough to assess your specific needs.</p>
      ` : `
      <p>Your quote includes detailed pricing and service specifications. You can review, accept, or request changes directly through our secure portal.</p>
      `}
      
      <div style="text-align: center; margin: 35px 0;">
        <a href="${quoteUrl}" class="cta-button">
          ${isWalkthroughProposal ? 'View Proposal & Book Walkthrough →' : 'View & Accept Quote →'}
        </a>
      </div>
      
      <div class="info-box">
        <p style="margin: 0; font-weight: 700; color: #f57c00; margin-bottom: 8px;">
          ${isWalkthroughProposal ? '⏰ Next Steps' : '⏰ Quote Expiry'}
        </p>
        <p style="margin: 0; color: #666666;">
          ${isWalkthroughProposal 
            ? 'Please review the proposal and schedule a walkthrough at your convenience. We\'ll provide a final, binding quote after assessing your site.'
            : 'This quote is valid for 7 days. Please review and respond before the expiration date.'}
        </p>
      </div>
      
      <p style="color: #666666; font-size: 14px; margin-top: 30px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${quoteUrl}" style="color: #0D47A1; word-break: break-all;">${quoteUrl}</a>
      </p>
      
      <p style="margin: 30px 0 10px 0; color: #555555;">
        Questions? We're here to help!<br>
        <strong style="color: #0D47A1;">The Northern Facilities Group Team</strong>
      </p>
    </div>
    <div class="footer">
      <p style="margin: 0 0 10px 0; font-weight: 700; color: #0D47A1;">Northern Facilities Group</p>
      <p style="margin: 0;">Professional Facilities Management Solutions</p>
      <p style="margin: 15px 0 0 0; font-size: 11px; color: #999999;">
        © 2025 Northern Facilities Group. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
    `

    // Get from email from environment or use default
    const fromEmail = Deno.env.get('resend_from_email') || 
                      Deno.env.get('RESEND_FROM_EMAIL') || 
                      'NFG Facilities <noreply@northernfacilitiesgroup.ca>'

    // Send email via Resend API
    const emailPayload = {
      from: fromEmail,
      to: emails,
      subject: subject,
      html: emailHTML,
    }

    console.log('Sending quote email via Resend:', { to: emails, subject })

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })

    const emailData = await emailResponse.json()

    if (!emailResponse.ok) {
      console.error('Resend API error:', emailData)
      throw new Error(`Failed to send email: ${emailData.message || JSON.stringify(emailData)}`)
    }

    console.log('✅ Quote email sent successfully via Resend!', emailData)

    return new Response(
      JSON.stringify({ success: true, messageId: emailData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending quote email:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
