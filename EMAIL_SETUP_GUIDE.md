# 📧 Email Setup Guide for User Invitations

## Current Status: ✅ Semi-Automatic (Email Client Integration)

Your invitation system is now set up to **automatically open your email client** with a pre-filled professional invitation email. This works immediately with no additional setup!

### How it works now:
1. Click "Invite User" in Settings
2. Enter email and role
3. System opens your default email client (Gmail, Outlook, Apple Mail, etc.)
4. Email is pre-filled with invitation link
5. You click "Send" in your email client

---

## 🚀 Upgrade to Fully Automatic Emails (Optional)

Want emails to send **completely automatically** without opening your email client? Follow these steps:

### Option 1: Using Resend (Recommended - Free tier available)

#### Step 1: Sign up for Resend
1. Go to [resend.com](https://resend.com)
2. Sign up for a free account (100 emails/day free)
3. Verify your domain or use their test domain

#### Step 2: Get your API Key
1. Go to Settings → API Keys
2. Create a new API key
3. Copy the key (starts with `re_`)

#### Step 3: Deploy the Edge Function
```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Set the Resend API key as a secret
supabase secrets set RESEND_API_KEY=re_your_api_key_here

# Deploy the function
supabase functions deploy send-invitation-email
```

#### Step 4: Update the "from" email
Edit `supabase/functions/send-invitation-email/index.ts`:
```typescript
from: 'NFG Facilities <noreply@yourdomain.com>', // Change to your verified domain
```

#### Step 5: Test it!
- Go to Settings → User Management
- Click "Invite User"
- Enter an email address
- Email will be sent automatically! ✅

---

### Option 2: Using SendGrid

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Get your API key
3. Modify the Edge Function to use SendGrid API instead of Resend
4. Deploy using the same steps above

---

### Option 3: Using Gmail SMTP (For testing only)

⚠️ **Not recommended for production** - Use for testing only

1. Enable "Less secure app access" in your Gmail account
2. Create an app-specific password
3. Modify the Edge Function to use SMTP
4. Deploy

---

## 📝 Edge Function Details

The Edge Function (`supabase/functions/send-invitation-email/index.ts`) will:
- ✅ Send professional HTML emails
- ✅ Include role-specific information
- ✅ Add NFG branding
- ✅ Include expiration warnings
- ✅ Provide clickable invitation links
- ✅ Work completely automatically

### Email Template Preview:
```
Subject: Invitation to join NFG Facilities Management

[NFG Logo Header]

Hello!

You've been invited by admin@nfg.com to join the NFG Facilities Management system.

Your assigned role: STAFF

What this means:
• View and complete assigned jobs

[Accept Invitation & Set Password] (Blue Button)

Important: This invitation link expires in 7 days.

If the button doesn't work, copy and paste this link...

Best regards,
Northern Facilities Group Team
```

---

## 🔍 Troubleshooting

### Email client doesn't open?
- Check your browser settings - it might be blocking popups
- Allow popups for your local development site
- The link is also copied to clipboard as a backup

### Want to change the email template?
- Edit `supabase/functions/send-invitation-email/index.ts`
- Customize the HTML in the `emailHTML` variable
- Redeploy the function

### Emails going to spam?
- Verify your domain in Resend
- Add SPF and DKIM records to your domain
- Use a professional "from" address

---

## 💰 Cost Comparison

| Service | Free Tier | Paid |
|---------|-----------|------|
| **Current Setup (Email Client)** | ✅ Free forever | Free |
| **Resend** | 100 emails/day | $20/mo for 50k emails |
| **SendGrid** | 100 emails/day | $19.95/mo for 50k emails |
| **AWS SES** | First 62k free/month | $0.10 per 1k emails |

---

## 🎯 Recommendation

**For most users**: The current email client integration is perfect! It's free, works immediately, and gives you control over each invitation.

**For high volume**: If you're sending 10+ invitations per day, set up Resend for fully automatic emails.

---

## Need Help?

If you run into issues:
1. Check the browser console for errors
2. Verify your Resend API key is set correctly
3. Check Supabase Edge Function logs
4. Make sure your domain is verified in Resend


















