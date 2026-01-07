# 📧 Resend Quick Setup Guide

## Step 1: Sign Up for Resend (If You Haven't)

1. Go to **https://resend.com**
2. Click **"Sign Up"** or **"Get Started"**
3. Sign up with your email (or use GitHub/Google)
4. Verify your email address

---

## Step 2: Get Your API Key

1. Once logged in, go to **API Keys** (left sidebar)
2. Click **"Create API Key"**
3. Give it a name: `NFG App Production`
4. Select permissions: **"Full Access"** (or "Sending Access")
5. Click **"Add"**
6. **COPY THE API KEY** — you won't see it again! 
   - It looks like: `re_123456789abcdefghijklmnop`

---

## Step 3: Add Secrets to Supabase

You're already on the right page! In the Supabase Dashboard:

### 3a. Add RESEND_API_KEY

1. In the **"ADD NEW SECRETS"** section at the top:
   - **Key:** `RESEND_API_KEY`
   - **Value:** Paste your Resend API key (the one you just copied)
   - Click the **green "Save" button**

### 3b. Add RESEND_FROM_EMAIL

1. Click **"Add another"** to add a second secret
2. **Key:** `RESEND_FROM_EMAIL`
3. **Value:** Choose one:

   **Option A: Use Resend's Default (Free, No Setup)**
   ```
   NFG <onboarding@resend.dev>
   ```

   **Option B: Use Your Custom Domain (If You Have One)**
   ```
   NFG <noreply@northernfacilitiesgroup.ca>
   ```
   *(You'll need to verify your domain in Resend first)*

4. Click the **green "Save" button** again

---

## Step 4: Verify Secrets Are Set

After saving, scroll down and you should see:
- ✅ `RESEND_API_KEY` with a SHA256 hash
- ✅ `RESEND_FROM_EMAIL` with a SHA256 hash

---

## Step 5: Test It! 🧪

### Option A: Test via Supabase Dashboard

1. Go to **Edge Functions** → **send-notification-email**
2. Click **"Invoke"** or **"Test"**
3. Use this test payload:

```json
{
  "notification": {
    "user_id": "your-user-id-here",
    "type": "job_assigned",
    "title": "Test Notification",
    "message": "This is a test email from NFG",
    "link": "https://yourapp.com",
    "metadata": {}
  },
  "user_email": "your-email@example.com"
}
```

### Option B: Test via Your App

1. Assign a worker to a site (or create a booking)
2. The worker should receive an email notification
3. Check your Resend dashboard → **Logs** to see if it was sent

---

## ✅ Setup Complete!

Your emails will now be sent from:
- **From Address:** Whatever you set in `RESEND_FROM_EMAIL`
- **Default:** `NFG <onboarding@resend.dev>` (if you didn't set custom)

---

## 🔧 Optional: Custom Domain Setup

If you want to use `noreply@yourdomain.com`:

### Step 1: Add Domain in Resend
1. Go to Resend Dashboard → **Domains**
2. Click **"Add Domain"**
3. Enter your domain: `northernfacilitiesgroup.ca`
4. Add the DNS records Resend provides to your domain's DNS

### Step 2: Verify Domain
1. Wait for DNS propagation (5-30 minutes)
2. Resend will show "Verified" status

### Step 3: Update Secret
1. Go back to Supabase → Edge Functions → Secrets
2. Update `RESEND_FROM_EMAIL` to: `NFG <noreply@northernfacilitiesgroup.ca>`
3. Save

---

## 📊 Free Tier Limits

- **100 emails/day** (plenty for most apps)
- **3,000 emails/month**
- Unlimited domains (once verified)

**Upgrade:** $20/mo for 50,000 emails/month

---

## 🐛 Troubleshooting

### Emails Not Sending?
1. ✅ Check `RESEND_API_KEY` is set correctly
2. ✅ Check `RESEND_FROM_EMAIL` is set correctly
3. ✅ Check Resend Dashboard → Logs for errors
4. ✅ Verify the Edge Function is deployed: `supabase functions deploy send-notification-email`

### "Invalid API Key" Error?
- Make sure you copied the full API key (starts with `re_`)
- Make sure there are no extra spaces

### Emails Going to Spam?
- Use a verified custom domain (better deliverability)
- Keep email content clean and professional

---

## 🎉 Done!

Your notification emails are now set up! Test it by creating a booking or assigning a worker to a site.









