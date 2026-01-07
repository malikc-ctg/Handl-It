# 🔍 Troubleshooting Email Notifications

## Issue: Emails Not Being Sent to Resend

### Step 1: Check if SQL Script Was Run

You need to run the SQL setup script to create the database trigger. Run this:

**File:** `FIX_EMAIL_NOTIFICATIONS.sql`

Or run it directly in Supabase SQL Editor:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create a new query
3. Copy and paste the contents of `FIX_EMAIL_NOTIFICATIONS.sql`
4. Click **"Run"**

This will:
- ✅ Enable `pg_net` extension (required!)
- ✅ Create the trigger function
- ✅ Create the trigger on notifications table

---

### Step 2: Verify Trigger Exists

Run this in SQL Editor:

```sql
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'notifications';
```

You should see: `trigger_send_notification_email`

---

### Step 3: Test Notification Creation

Run this test in SQL Editor (replace `YOUR_USER_ID` with an actual user ID):

```sql
-- Test notification
INSERT INTO notifications (user_id, type, title, message, link)
VALUES (
  'YOUR_USER_ID_HERE',  -- Replace with actual user ID
  'system',
  'Test Notification',
  'This is a test email notification',
  'https://yourapp.com'
);
```

**Then check:**
1. Supabase → Edge Functions → send-notification-email → **Logs**
2. Resend Dashboard → **Logs**
3. Your email inbox

---

### Step 4: Check Edge Function Logs

1. Go to **Supabase Dashboard** → **Edge Functions** → **send-notification-email**
2. Click **"Logs"** tab
3. Look for:
   - ✅ Successful invocations
   - ❌ Error messages

**Common errors:**
- `RESEND_API_KEY not configured` → Need to add secret
- `pg_net extension not enabled` → Need to run SQL script
- `Trigger not found` → Need to create trigger

---

### Step 5: Check Secrets Are Set

Go to **Supabase** → **Edge Functions** → **Secrets**, verify:

- ✅ `RESEND_API_KEY` exists
- ✅ `RESEND_FROM_EMAIL` exists (optional but recommended)

---

### Step 6: Verify pg_net Extension

Run in SQL Editor:

```sql
SELECT extname, extversion 
FROM pg_extension 
WHERE extname = 'pg_net';
```

**Should show:** `pg_net` with a version number

**If not showing:** Run `CREATE EXTENSION IF NOT EXISTS pg_net;`

---

## 🧪 Complete Test Flow

1. **Run the SQL script:** `FIX_EMAIL_NOTIFICATIONS.sql`
2. **Create a test notification** (see Step 3 above)
3. **Check Supabase Edge Function logs** → Should see the function being called
4. **Check Resend logs** → Should see email being sent
5. **Check your email** → Should receive the email!

---

## 📋 Quick Checklist

- [ ] `pg_net` extension enabled
- [ ] `send_notification_email()` function exists
- [ ] `trigger_send_notification_email` trigger exists
- [ ] Edge Function `send-notification-email` deployed
- [ ] `RESEND_API_KEY` secret set in Supabase
- [ ] `RESEND_FROM_EMAIL` secret set (optional)
- [ ] Domain verified in Resend (if using custom domain)

---

## 🐛 Still Not Working?

1. **Check Supabase logs** → Edge Functions → send-notification-email → Logs
2. **Check database logs** → SQL Editor → Run test query
3. **Check notification was created** → Table Editor → `notifications` table
4. **Check user has email** → Table Editor → `auth.users` table

Tell me what you see in the logs and I'll help debug!









