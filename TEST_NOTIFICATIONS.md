# ✅ Test Your Notification Setup

## Quick Verification Checklist

### ✅ 1. Supabase Secrets (Check these are set)
Go to Supabase → Edge Functions → Secrets, verify you have:
- `RESEND_API_KEY` ✓
- `RESEND_FROM_EMAIL` = `NFG <noreply@nfgone.ca>` ✓

### ✅ 2. Resend Domain Status
Go to Resend Dashboard → Domains:
- Is `nfgone.ca` showing as **"Verified"** (green checkmark)? ✓

### ✅ 3. Edge Function Deployed
Make sure the function is deployed:
```bash
supabase functions deploy send-notification-email
```

---

## 🧪 How to Test

### Test 1: Assign a Worker to a Site

1. Go to your app → **Settings** → **User Management**
2. Click on a user (staff member)
3. Click **"Assign Site"**
4. Select a site and assign it
5. **Check your email** - the worker should get a notification email!

### Test 2: Create a Booking

1. Go to your app → **Bookings** → **New Booking**
2. Create a booking
3. If the site has an assigned worker, they should get an email about the new job

### Test 3: Complete a Job

1. Go to **Jobs** page
2. Open a job and complete all tasks
3. Admins should get an email notification

---

## 🔍 Check Resend Logs

1. Go to **Resend Dashboard** → **Logs**
2. You should see emails being sent
3. Check:
   - ✅ Status: "Delivered" (not bounced/failed)
   - ✅ From: `noreply@nfgone.ca` (your custom domain!)
   - ✅ Subject: Should match your notification titles

---

## 🐛 Troubleshooting

### No emails being sent?

1. **Check Edge Function logs:**
   - Supabase Dashboard → Edge Functions → send-notification-email
   - Click "Logs" tab
   - Look for errors

2. **Check if notifications are being created:**
   - Supabase Dashboard → Table Editor → `notifications` table
   - Should see new rows when actions happen

3. **Check preferences:**
   - Settings → Notification Preferences
   - Make sure "Email Notifications" is ON
   - Make sure the specific notification type is ON

### Emails going to spam?

- Custom domain helps (you're using nfgone.ca ✓)
- Make sure SPF, DKIM records are correct in DNS
- Wait 24-48 hours for domain reputation to build

### Wrong "From" address?

- Check Supabase Secret `RESEND_FROM_EMAIL` is set correctly
- Should be: `NFG <noreply@nfgone.ca>`
- No extra spaces or quotes

---

## ✅ Everything Working?

If emails are being sent from `noreply@nfgone.ca` and arriving in inbox (not spam), you're all set! 🎉









