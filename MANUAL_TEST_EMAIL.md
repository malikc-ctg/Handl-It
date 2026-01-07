# 🧪 Manual Email Test

Let's test the email system manually to see where it's breaking.

## Step 1: Test Edge Function Directly

1. Go to **Supabase Dashboard** → **Edge Functions** → **send-notification-email**
2. Click **"Invoke"** or **"Test"** button
3. Use this test payload:

```json
{
  "notification": {
    "id": "00000000-0000-0000-0000-000000000000",
    "user_id": "YOUR_USER_ID_HERE",
    "type": "system",
    "title": "Test Email",
    "message": "Testing if emails work",
    "link": "https://nfgone.ca",
    "metadata": {}
  },
  "user_email": "your-email@example.com"
}
```

**Replace:**
- `YOUR_USER_ID_HERE` with your actual user ID (from auth.users table)
- `your-email@example.com` with your email address

4. Click **"Invoke"**

**What to check:**
- ✅ Does it return success?
- ✅ Check Resend Dashboard → Logs (did email get sent?)
- ✅ Check your email inbox

---

## Step 2: Check if Notifications Are Being Created

1. Go to **Supabase Dashboard** → **Table Editor** → `notifications`
2. Do you see any rows? If yes, check the `created_at` column
3. When you assign a worker to a site, does a new row appear?

---

## Step 3: Test Database Trigger Manually

Run this in **SQL Editor** (replace `YOUR_USER_ID`):

```sql
-- Get your user ID first
SELECT id, email FROM auth.users LIMIT 1;

-- Then create a test notification (use the ID from above)
INSERT INTO notifications (user_id, type, title, message, link)
VALUES (
  'PASTE_YOUR_USER_ID_HERE',
  'system',
  'Manual Test Notification',
  'Testing database trigger',
  'https://nfgone.ca'
);
```

**Then immediately check:**
1. **Supabase** → **Edge Functions** → **send-notification-email** → **Logs**
   - Do you see a new log entry?
2. **Resend Dashboard** → **Logs**
   - Do you see an email attempt?

---

## Step 4: Check What's Happening

### Check A: Are notifications being created?
- ✅ Yes → Go to Check B
- ❌ No → The issue is in your app code (not calling createNotification)

### Check B: Is the trigger firing?
- Go to Edge Function logs after creating notification
- ✅ Trigger fires → Go to Check C
- ❌ No logs → Trigger isn't set up or pg_net isn't working

### Check C: Is Edge Function working?
- Check Edge Function logs for errors
- ✅ Working → Go to Check D
- ❌ Errors → Check error message

### Check D: Is Resend sending?
- Check Resend Dashboard → Logs
- ✅ Sending → Check spam folder
- ❌ Not sending → Check RESEND_API_KEY secret

---

## Common Issues & Solutions

### Issue: "pg_net extension not enabled"
**Fix:** Run `CREATE EXTENSION IF NOT EXISTS pg_net;` in SQL Editor

### Issue: "RESEND_API_KEY not configured"
**Fix:** Add `RESEND_API_KEY` secret in Supabase → Edge Functions → Secrets

### Issue: Trigger not firing
**Fix:** Run `FIX_EMAIL_NOTIFICATIONS.sql` again

### Issue: Edge Function error
**Check:** Edge Function logs for specific error message

---

## Tell Me What You See

After testing, tell me:
1. ✅/❌ Are notifications being created in the database?
2. ✅/❌ Do you see logs in Edge Function when notification is created?
3. ✅/❌ Do you see emails in Resend logs?
4. ✅/❌ What errors (if any) do you see?









