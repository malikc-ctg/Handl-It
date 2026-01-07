# 🔍 Troubleshooting Checklist

Run `COMPLETE_DIAGNOSTIC.sql` and tell me:

## ✅/❌ Checklist

1. **User exists?**
   - Does the query show your user with email `malikjcampbell05@gmail.com`?
   - ✅ Yes / ❌ No

2. **Notification created?**
   - Does the query show notifications in the database?
   - ✅ Yes / ❌ No

3. **Trigger exists?**
   - Does it show `trigger_send_notification_email`?
   - ✅ Yes / ❌ No

4. **pg_net enabled?**
   - Does it say "✅ pg_net enabled"?
   - ✅ Yes / ❌ No

5. **Function uses pg_net?**
   - Does it say "✅ Uses pg_net"?
   - ✅ Yes / ❌ No

6. **Edge Function logs?**
   - Go to: Supabase → Edge Functions → send-notification-email → Logs
   - After running diagnostic, do you see ANY new log entries?
   - ✅ Yes, I see logs / ❌ No logs at all

7. **Resend logs?**
   - Go to: Resend Dashboard → Logs
   - Do you see ANY emails being attempted?
   - ✅ Yes / ❌ No

---

## Most Common Issues

### Issue 1: pg_net not enabled
**Fix:** Run `CREATE EXTENSION IF NOT EXISTS pg_net;`

### Issue 2: Trigger not firing
**Fix:** The trigger might not be set up. Run `FIX_EMAIL_NOTIFICATIONS.sql`

### Issue 3: Edge Function not being called
**Fix:** pg_net might not be working. Need to check logs.

### Issue 4: Resend API key not set
**Fix:** Check Supabase → Edge Functions → Secrets → `RESEND_API_KEY` exists

---

**Run the diagnostic and tell me which items are ❌ so I can fix them!**









