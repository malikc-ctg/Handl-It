import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
    const { to, subject, emailContent, bookingDate, bookingTime } = await req.json()

    if (!to || !emailContent) {
      throw new Error('to and emailContent are required')
    }

    // Convert plain text email to HTML format
    const emailHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NFG Walkthrough Welcome</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f7fa;
      line-height: 1.6;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .content {
      padding: 40px 30px;
      color: #333333;
    }
    .content p {
      margin: 15px 0;
      color: #555555;
    }
    .content ul {
      margin: 15px 0;
      padding-left: 20px;
    }
    .content li {
      margin: 8px 0;
      color: #555555;
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
    <div class="content">
      ${emailContent.split('\n').map(line => {
        const trimmed = line.trim();
        if (trimmed === '') return '<p>&nbsp;</p>';
        if (trimmed.startsWith('•')) {
          // Format bullet points
          const text = trimmed.substring(1).trim();
          return `<p style="margin-left: 20px; margin-bottom: 8px;">• ${text}</p>`;
        }
        // Format regular paragraphs
        if (trimmed.length > 0) {
          return `<p>${trimmed}</p>`;
        }
        return '';
      }).filter(html => html.length > 0).join('')}
    </div>
    <div class="footer">
      <p style="margin: 0; font-weight: 700; color: #0D47A1;">Northern Facilities Group</p>
      <p style="margin: 5px 0;">Professional Facilities Management Solutions</p>
    </div>
  </div>
</body>
</html>
    `.trim()

    // Get from email from environment or use default
    const fromEmail = Deno.env.get('resend_from_email') || 
                      Deno.env.get('RESEND_FROM_EMAIL') || 
                      'NFG Facilities <noreply@northernfacilitiesgroup.ca>'

    // Send email via Resend API
    const emailPayload = {
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject: subject || 'Welcome to Northern Facilities Group',
      html: emailHTML,
    }

    console.log('Sending walkthrough welcome email via Resend:', { to, subject })

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

    console.log('✅ Walkthrough welcome email sent successfully via Resend!', emailData)

    return new Response(
      JSON.stringify({ success: true, messageId: emailData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending walkthrough welcome email:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
