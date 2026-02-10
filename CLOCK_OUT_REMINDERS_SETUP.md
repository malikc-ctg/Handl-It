# Clock-Out Reminders (12-Hour) – Setup

After **12 hours** of being clocked in, users get an in-app notification: *"Still working? You've been clocked in for over 12 hours. Don't forget to clock out when you're done, or tap here to open the time clock."* Tapping the notification opens the clock-in/out modal.

## 1. Deploy the Edge Function

From the project root:

```bash
supabase functions deploy send-clock-out-reminders
```

## 2. Schedule the Function (Cron)

Run the function **every hour** so anyone who has been clocked in for 12+ hours gets at most one reminder per session.

### Option A: cron-job.org (free)

1. Go to [cron-job.org](https://cron-job.org/) and create a cron job.
2. **URL:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-clock-out-reminders`
3. **Schedule:** `0 * * * *` (every hour at :00).
4. **Method:** POST  
5. **Headers:**
   - `Authorization: Bearer YOUR_SUPABASE_ANON_KEY`
   - `Content-Type: application/json`
6. **Body:** `{}` (optional).

Replace `YOUR_PROJECT_REF` and `YOUR_SUPABASE_ANON_KEY` with your Supabase project URL ref and anon key (Dashboard → Settings → API).

### Option B: pg_cron (Supabase)

If your project has **pg_cron** enabled (Database → Extensions), you can schedule the function from SQL. Use the same pattern as morning reminders: `pg_net` or an HTTP extension to call your Edge Function URL with the anon key. If you only have `cron.schedule` and no HTTP, use Option A instead.

## 3. Test Manually

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-clock-out-reminders" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `{"success":true,"message":"Clock-out reminders sent","users_notified":N,...}` or `"No users clocked in 12+ hours"` when no one is over 12 hours.

## Behavior

- **Source:** `time_entries` where `clock_out` is `NULL` and `clock_in` is older than 12 hours.
- **Deduplication:** Only one reminder per open time entry (stored in notification `metadata.time_entry_id`). Hourly cron will not spam the same user for the same session.
- **In-app:** Notification appears in the app; tapping it opens the clock-in/out modal (same as the morning reminder).
