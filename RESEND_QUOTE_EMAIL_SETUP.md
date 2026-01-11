# 📧 Resend Email Setup for Quote System

## Quick Setup (5 minutes)

### Step 1: Sign up for Resend
1. Go to [resend.com](https://resend.com)
2. Sign up for a free account (100 emails/day free)
3. Verify your domain or use their test domain (`onboarding.resend.dev`)

### Step 2: Get your API Key
1. In Resend dashboard, go to **API Keys**
2. Click **Create API Key**
3. Give it a name like "NFG Quote System"
4. Copy the key (starts with `re_`)

### Step 3: Set Supabase Secrets

Run these commands in Terminal:

```bash
cd "/Users/malikcampbell/NFG APP V3"

# Login to Supabase CLI (if not already)
supabase login

# Link to your project (get project ref from Supabase dashboard URL)
supabase link --project-ref YOUR_PROJECT_REF

# Set Resend API key
supabase secrets set RESEND_API_KEY=re_your_api_key_here

# Set the "from" email address (use your verified domain or onboarding.resend.dev for testing)
supabase secrets set RESEND_FROM_EMAIL="NFG Facilities <noreply@yourdomain.com>"

# Set quote portal URL (your app's public URL)
supabase secrets set QUOTE_PORTAL_URL="https://your-domain.com"
```

### Step 4: Deploy the Edge Function

```bash
supabase functions deploy send-quote-email
```

### Step 5: Test It!

1. Go to Sales → Quotes
2. Create a new quote
3. Click "Send Quote"
4. Enter recipient email addresses
5. Click "Send"
6. Email should be sent automatically! ✅

---

## Troubleshooting

### Emails not sending?

1. **Check Supabase Logs:**
   ```bash
   supabase functions logs send-quote-email
   ```

2. **Verify API Key:**
   - Make sure `RESEND_API_KEY` is set correctly
   - Check Resend dashboard → API Keys → verify key is active

3. **Check Email Domain:**
   - If using test domain (`onboarding.resend.dev`), emails go to your Resend dashboard's test inbox
   - For production, verify your domain in Resend first

4. **Check From Email:**
   - Must match a verified domain in Resend
   - Or use `onboarding.resend.dev` for testing

### Common Errors

**"RESEND_API_KEY is not set"**
- Run: `supabase secrets set RESEND_API_KEY=re_your_key_here`
- Redeploy: `supabase functions deploy send-quote-email`

**"Failed to send email: Unauthorized"**
- API key is incorrect or expired
- Get a new key from Resend dashboard

**"From email not verified"**
- Use `onboarding.resend.dev` for testing, OR
- Verify your domain in Resend dashboard first

---

## Cost

- **Free Tier:** 100 emails/day
- **Paid:** $20/month for 50,000 emails

Perfect for most quote systems! 🎯
