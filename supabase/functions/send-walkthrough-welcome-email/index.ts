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

    // Convert plain text email to HTML format with NFG branding
    const logoUrl = 'https://zqcbldgheimqrnqmbbed.supabase.co/storage/v1/object/sign/app-images/Horizontal.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xN2RmNDhlMi0xNGJlLTQ5NzMtODZlNy0zZTc0MjgzMWIzOTQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhcHAtaW1hZ2VzL0hvcml6b250YWwucG5nIiwiaWF0IjoxNzY4NzAxODYwLCJleHAiOjMxNTM2MTczNzE2NTg2MH0.YZkuogRo1ewwYjK_URU-zOkPE7uPwoQmPMHGUZmHEVk'
    
    const emailHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>NFG Walkthrough Welcome</title>
  <style>
    /* Reset styles */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    
    /* Base styles */
    body {
      margin: 0;
      padding: 0;
      width: 100%;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f7fa;
    }
    
    /* Container */
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border-radius: 12px;
      overflow: hidden;
    }
    
    /* Header */
    .header {
      background: linear-gradient(135deg, #0D47A1 0%, #0A3A84 100%);
      padding: 40px 30px;
      text-align: center;
    }
    
    .logo {
      max-width: 300px;
      height: auto;
      margin-bottom: 15px;
    }
    
    /* Content */
    .content {
      padding: 40px 30px;
      line-height: 1.6;
      color: #333333;
    }
    
    .content p {
      margin: 15px 0;
      color: #555555;
      font-size: 16px;
    }
    
    .content ul {
      margin: 15px 0;
      padding-left: 20px;
    }
    
    .content li {
      margin: 8px 0;
      color: #555555;
      font-size: 16px;
    }
    
    .greeting {
      font-size: 20px;
      font-weight: 600;
      color: #0D47A1;
      margin: 0 0 20px 0;
    }
    
    /* Footer */
    .footer {
      background: #f8f9fa;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e9ecef;
    }
    
    .footer-brand {
      font-weight: 700;
      color: #0D47A1;
      font-size: 18px;
      margin-bottom: 8px;
    }
    
    .footer-text {
      font-size: 13px;
      color: #6c757d;
      margin: 5px 0;
    }
    
    /* Responsive */
    @media only screen and (max-width: 600px) {
      .content { padding: 25px 20px !important; }
      .header { padding: 30px 20px !important; }
      .logo { max-width: 250px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f7fa;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 0; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" class="email-container" style="max-width: 600px; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 12px; overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td class="header">
              <img src="${logoUrl}" alt="Northern Facilities Group Inc" class="logo" style="max-width: 300px; height: auto; margin-bottom: 15px;">
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td class="content">
              ${emailContent.split('\n').map(line => {
                const trimmed = line.trim();
                if (trimmed === '') return '<p>&nbsp;</p>';
                // Check if it's a greeting line (starts with "Dear")
                if (trimmed.startsWith('Dear')) {
                  return `<p class="greeting">${trimmed}</p>`;
                }
                if (trimmed.startsWith('•')) {
                  // Format bullet points
                  const text = trimmed.substring(1).trim();
                  return `<p style="margin-left: 20px; margin-bottom: 8px; color: #555555; font-size: 16px;">• ${text}</p>`;
                }
                // Format regular paragraphs
                if (trimmed.length > 0) {
                  return `<p style="margin: 15px 0; color: #555555; font-size: 16px;">${trimmed}</p>`;
                }
                return '';
              }).filter(html => html.length > 0).join('')}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td class="footer">
              <p class="footer-brand" style="margin: 0; font-weight: 700; color: #0D47A1; font-size: 18px; margin-bottom: 8px;">Northern Facilities Group Inc</p>
              <p class="footer-text" style="margin: 5px 0; font-size: 13px; color: #6c757d;">Professional Facilities Management Solutions</p>
              
              <div style="border-top: 1px solid #e9ecef; padding-top: 15px; margin-top: 15px;">
                <p class="footer-text" style="margin: 5px 0; font-size: 12px;">
                  <strong>Phone:</strong> 855-664-1144
                </p>
                <p class="footer-text" style="margin: 5px 0; font-size: 12px;">
                  <strong>Email:</strong> info@northernfacilitiesgroup.ca
                </p>
              </div>
              
              <p class="footer-text" style="margin-top: 20px; font-size: 11px; color: #999999;">© 2025 Northern Facilities Group Inc. All rights reserved.</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
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
      subject: subject || 'Welcome to Northern Facilities Group Inc',
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
