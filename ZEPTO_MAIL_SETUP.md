# 🚀 ZeptoMail Setup (Recommended for Automatic Emails)

ZeptoMail is Zoho's **transactional email service** - it's specifically designed for sending automated emails like invitations. It's simpler and more reliable than Zoho Mail API.

---

## Why ZeptoMail?

- ✅ **Built for automation** (not for reading emails)
- ✅ **Simpler setup** (just need an API key, no OAuth)
- ✅ **Free tier**: 10,000 emails/month
- ✅ **Better deliverability** for automated emails
- ✅ **Works perfectly for invitation emails**

---

## 🔧 Setup (5 minutes)

### Step 1: Sign up for ZeptoMail

1. Go to: https://www.zoho.com/zeptomail/
2. Sign up with your Zoho account
3. Verify your domain (or use their test domain for now)

### Step 2: Get Your API Key

1. In ZeptoMail dashboard, go to **Settings** → **SMTP & API Info**
2. Click **"Mail Agent"** tab
3. Create a new Mail Agent: "NFG Facilities"
4. Copy the **Send Mail Token** (starts with `Zoho-enczapikey`)

### Step 3: Update Supabase Secrets

Run this in Terminal:
```bash
cd "/Users/malikcampbell/NFG APP V3"

# Set ZeptoMail API key (replace with your actual key)
supabase secrets set ZEPTO_MAIL_KEY="Zoho-enczapikey_YOUR_KEY_HERE"

# Redeploy
supabase functions deploy send-invitation-email
```

---

## ✅ That's It!

Much simpler than OAuth! No refresh tokens, no client IDs, just one API key.

---

## 🧪 Test

1. Refresh settings page
2. Send an invitation
3. Email should arrive within seconds! ✅

---

## 📊 Comparison

| Feature | Zoho Mail API | ZeptoMail |
|---------|---------------|-----------|
| **Purpose** | Read/manage emails | Send automated emails |
| **Setup** | Complex OAuth | Simple API key |
| **Free Tier** | ~100 emails/day | 10,000 emails/month |
| **Best For** | Email clients | Transactional emails ✅ |

---

**Let's switch to ZeptoMail - it's the right tool for the job!** 🎯

















