// Supabase Edge Function for sending invitation emails
// Deploy this to enable automatic email sending

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
    // Get request body
    const { email, role, invitationLink, inviterEmail } = await req.json()

    // Validate inputs
    if (!email || !role || !invitationLink) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Role-specific permissions display
    const rolePermissions = {
      admin: [
        'Full system access and user management',
        'Create and manage all sites, jobs, and bookings',
        'Assign workers and manage permissions',
        'Access all reports and analytics'
      ],
      client: [
        'Manage sites, jobs, and bookings',
        'Invite and manage staff members',
        'Assign workers to sites',
        'View reports and job completion status'
      ],
      staff: [
        'View jobs assigned to you',
        'Complete tasks and upload photo proof',
        'Track work time and job progress',
        'Access your assigned sites'
      ]
    }

    const permissions = rolePermissions[role] || rolePermissions['staff']
    const permissionsHTML = permissions.map(p => `<li style="margin: 8px 0;">${p}</li>`).join('')

    // Create email HTML template
    const emailHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>NFG Invitation</title>
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
    }
    
    /* Header */
    .header {
      background: linear-gradient(135deg, #0D47A1 0%, #0A3A84 100%);
      padding: 40px 30px;
      text-align: center;
    }
    
    .logo {
      max-width: 250px;
      height: auto;
      margin-bottom: 20px;
    }
    
    .header-title {
      color: #ffffff;
      font-size: 28px;
      font-weight: 700;
      margin: 0;
      padding: 10px 0 0 0;
    }
    
    .header-subtitle {
      color: #E3ECFA;
      font-size: 16px;
      margin: 10px 0 0 0;
    }
    
    /* Content */
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
    
    .intro-text {
      font-size: 16px;
      margin: 0 0 20px 0;
      color: #555555;
    }
    
    /* Role Badge */
    .role-container {
      background: linear-gradient(135deg, #E3ECFA 0%, #d4e4f7 100%);
      border-left: 4px solid #0D47A1;
      padding: 20px;
      margin: 25px 0;
      border-radius: 8px;
    }
    
    .role-label {
      font-size: 12px;
      text-transform: uppercase;
      color: #0A3A84;
      font-weight: 700;
      letter-spacing: 1px;
      margin: 0 0 8px 0;
    }
    
    .role-badge {
      display: inline-block;
      background: #0D47A1;
      color: #ffffff;
      padding: 8px 20px;
      border-radius: 20px;
      font-size: 18px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    /* Permissions */
    .permissions-section {
      margin: 25px 0;
    }
    
    .permissions-title {
      font-size: 16px;
      font-weight: 700;
      color: #0D47A1;
      margin: 0 0 15px 0;
    }
    
    .permissions-list {
      margin: 0;
      padding-left: 20px;
      color: #555555;
    }
    
    .permissions-list li {
      margin: 10px 0;
      line-height: 1.5;
    }
    
    /* Button */
    .button-container {
      text-align: center;
      margin: 35px 0;
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
      box-shadow: 0 4px 14px rgba(13, 71, 161, 0.25);
      transition: all 0.3s ease;
    }
    
    .cta-button:hover {
      box-shadow: 0 6px 20px rgba(13, 71, 161, 0.35);
      transform: translateY(-2px);
    }
    
    /* Info Box */
    .info-box {
      background: #fff9e6;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 25px 0;
      border-radius: 4px;
    }
    
    .info-box-title {
      font-weight: 700;
      color: #f57c00;
      margin: 0 0 8px 0;
      font-size: 14px;
    }
    
    .info-box-text {
      margin: 0;
      font-size: 14px;
      color: #666666;
    }
    
    /* Link Fallback */
    .link-fallback {
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      padding: 15px;
      margin: 25px 0;
      border-radius: 8px;
    }
    
    .link-fallback-text {
      font-size: 13px;
      color: #666666;
      margin: 0 0 10px 0;
    }
    
    .link-code {
      background: #ffffff;
      border: 1px solid #dee2e6;
      padding: 10px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #0D47A1;
      word-break: break-all;
      border-radius: 4px;
      display: block;
    }
    
    /* Footer */
    .footer {
      background: #f8f9fa;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e9ecef;
    }
    
    .footer-text {
      font-size: 13px;
      color: #6c757d;
      margin: 5px 0;
    }
    
    .footer-brand {
      font-weight: 700;
      color: #0D47A1;
    }
    
    /* Responsive */
    @media only screen and (max-width: 600px) {
      .content { padding: 25px 20px !important; }
      .header { padding: 30px 20px !important; }
      .header-title { font-size: 24px !important; }
      .logo { max-width: 200px !important; }
      .cta-button { padding: 14px 30px !important; font-size: 14px !important; }
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
              <img src="https://zqcbldgheimqrnqmbbed.supabase.co/storage/v1/object/sign/app-images/2.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xN2RmNDhlMi0xNGJlLTQ5NzMtODZlNy0zZTc0MjgzMWIzOTQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhcHAtaW1hZ2VzLzIucG5nIiwiaWF0IjoxNzYxODY2MTE0LCJleHAiOjQ4ODM5MzAxMTR9.E1JoQZxqPy0HOKna6YfjPCfin5Pc3QF0paEV7qzVfDw" alt="Northern Facilities Group" class="logo" style="max-width: 300px; height: auto; margin-bottom: 15px;">
              <h1 class="header-title">Welcome to NFG! 🎉</h1>
              <p class="header-subtitle">Join Northern Facilities Group Management Platform</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td class="content">
              <p class="greeting">Hello!</p>
              
              <p class="intro-text">
                <strong>${inviterEmail || 'Your administrator'}</strong> has invited you to join the <strong style="color: #0D47A1;">Northern Facilities Group</strong> management platform.
              </p>
              
              <p class="intro-text" style="margin-top: 15px; font-size: 15px; color: #666666;">
                NFG provides professional facilities management solutions including job tracking, site management, team coordination, and real-time updates. Get started by accepting your invitation below.
              </p>
              
              <!-- Role Badge -->
              <div class="role-container">
                <p class="role-label">Your Role</p>
                <span class="role-badge">${role.toUpperCase()}</span>
              </div>
              
              <!-- Permissions -->
              <div class="permissions-section">
                <p class="permissions-title">✨ What you'll be able to do:</p>
                <ul class="permissions-list">
                  ${permissionsHTML}
                </ul>
              </div>
              
              <!-- CTA Button -->
              <div class="button-container">
                <a href="${invitationLink}" class="cta-button">
                  Accept Invitation & Set Password →
                </a>
              </div>
              
              <!-- Important Notice -->
              <div class="info-box">
                <p class="info-box-title">⏰ Important</p>
                <p class="info-box-text">This invitation link expires in <strong>7 days</strong>. Please accept it as soon as possible to get started.</p>
              </div>
              
              <!-- Link Fallback -->
              <div class="link-fallback">
                <p class="link-fallback-text">If the button doesn't work, copy and paste this link:</p>
                <code class="link-code">${invitationLink}</code>
              </div>
              
              <!-- NFG Branding Section -->
              <div style="margin: 35px 0; padding: 20px; background: linear-gradient(135deg, #E3ECFA 0%, #f0f6ff 100%); border-radius: 8px; border-left: 4px solid #0D47A1;">
                <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #0A3A84; text-transform: uppercase; letter-spacing: 0.5px;">About Northern Facilities Group</p>
                <p style="margin: 0; font-size: 13px; color: #555555; line-height: 1.6;">
                  We deliver comprehensive facilities management services with cutting-edge technology to streamline operations, improve efficiency, and ensure exceptional service quality.
                </p>
              </div>
              
              <p style="margin: 30px 0 10px 0; color: #555555;">
                Need help? Contact your administrator or visit our support portal for assistance.
              </p>
              
              <p style="margin: 10px 0; color: #555555;">
                Welcome aboard,<br>
                <strong style="color: #0D47A1; font-size: 16px;">The Northern Facilities Group Team</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td class="footer">
              <p class="footer-text footer-brand" style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">Northern Facilities Group</p>
              <p class="footer-text" style="margin-bottom: 15px;">Professional Facilities Management Solutions</p>
              
              <div style="border-top: 1px solid #e9ecef; padding-top: 15px; margin-top: 15px;">
                <p class="footer-text" style="margin: 5px 0; font-size: 12px;">
                  <strong>Email:</strong> support@northernfacilitiesgroup.ca
                </p>
                <p class="footer-text" style="margin: 5px 0; font-size: 12px;">
                  <strong>Website:</strong> www.northernfacilitiesgroup.ca
                </p>
              </div>
              
              <p class="footer-text" style="margin-top: 20px; font-size: 11px; color: #999999;">© 2025 Northern Facilities Group. All rights reserved.</p>
              <p class="footer-text" style="margin-top: 5px; font-size: 10px; color: #999999;">This is an automated message. Please do not reply to this email.</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `

    // Send email using Resend (modern, reliable transactional email service)
    const RESEND_API_KEY = Deno.env.get('resend_api_key') || Deno.env.get('RESEND_API_KEY')
    const RESEND_FROM_EMAIL = Deno.env.get('resend_from_email') || Deno.env.get('RESEND_FROM_EMAIL') || 'NFG <onboarding@resend.dev>'
    
    if (!RESEND_API_KEY) {
      console.warn('Resend API key not set')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email service not configured. Please set resend_api_key or RESEND_API_KEY in Edge Function secrets.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Sending email via Resend...')
    console.log('From:', RESEND_FROM_EMAIL, 'To:', email)

    // Resend API payload
    const emailPayload = {
      from: RESEND_FROM_EMAIL,
      to: [email],
      subject: 'You\'re Invited to Join Northern Facilities Group',
      html: emailHTML
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    })

    console.log('Resend response status:', emailResponse.status)

    const emailData = await emailResponse.json()

    if (!emailResponse.ok) {
      console.error('Resend API error:', emailData)
      throw new Error(`Failed to send email: ${emailData.message || emailData.error?.message || 'Unknown error'}`)
    }

    console.log('✅ Email sent successfully via Resend!', emailData)

    return new Response(
      JSON.stringify({ success: true, messageId: emailData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

