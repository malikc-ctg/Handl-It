# 📧 Simple Email Setup - Just 2 Steps!

## Step 1: Run ONE SQL Script

1. Open **Supabase Dashboard** → **SQL Editor** (left sidebar)
2. Click **"New query"** button
3. Open the file: **`COMPLETE_EMAIL_FIX.sql`**
4. Copy **EVERYTHING** (select all, copy)
5. Paste it into the SQL Editor
6. Click **"Run"** button (or press Ctrl+Enter / Cmd+Enter)

**That's it!** The script does everything automatically.

---

## Step 2: Check If It Worked

After running, check these 3 things:

### ✅ Check 1: Edge Function Logs
1. Go to **Edge Functions** → **send-notification-email**
2. Click **"Logs"** tab
3. Do you see a new log entry? ✅

### ✅ Check 2: Resend Logs  
1. Go to **Resend Dashboard** → **Logs**
2. Do you see an email being sent? ✅

### ✅ Check 3: Your Email
1. Check your email inbox
2. Check spam folder too
3. Do you see a test email? ✅

---

## 🎉 If You See All 3 Checks ✅

**You're done!** Email notifications are working!

Now when you:
- Assign a worker to a site
- Create a booking
- Complete a job

Emails will be sent automatically! 📧

---

## ❌ If Something Doesn't Work

Tell me which check failed:
- No Edge Function logs?
- No Resend logs?
- No email received?

I'll help you fix it!









