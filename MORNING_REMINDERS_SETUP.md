# Morning Reminders Setup Guide

## Overview
This system sends motivational morning reminders to all users at 8:30 AM Monday-Friday. Each day, all users receive the same randomly selected motivational quote.

## Components

1. **Edge Function**: `supabase/functions/send-morning-reminders/index.ts`
   - Checks if today is a weekday (Monday-Friday)
   - Fetches all active users
   - Picks a random motivational quote
   - Creates notifications for all users
   - Existing notification triggers handle email/push delivery

2. **Cron Schedule**: Runs the Edge Function at 8:30 AM (your timezone)

## Setup Instructions

### Step 1: Deploy the Edge Function

```bash
cd "/Users/malikcampbell/NFG APP V3"
supabase functions deploy send-morning-reminders
```

Or if using Supabase CLI for the first time:
```bash
supabase login
supabase link --project-ref zqcbldgheimqrnqmbbed
supabase functions deploy send-morning-reminders
```

### Step 2: Set Up Cron Schedule

You have two options:

#### Option A: Supabase Cron (Recommended)
If your Supabase project has cron support, you can set it up via SQL:

```sql
-- Run this in Supabase SQL Editor
SELECT cron.schedule(
  'morning-reminders',
  '30 8 * * 1-5',  -- 8:30 AM Monday-Friday (UTC)
  $$
  SELECT net.http_post(
    url := 'https://zqcbldgheimqrnqmbbed.supabase.co/functions/v1/send-morning-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

**Note**: Adjust the time `'30 8 * * 1-5'` based on your timezone:
- `'30 8 * * 1-5'` = 8:30 AM UTC (Monday-Friday)
- For EST (UTC-5): `'30 13 * * 1-5'` = 1:30 PM UTC = 8:30 AM EST
- For PST (UTC-8): `'30 16 * * 1-5'` = 4:30 PM UTC = 8:30 AM PST

#### Option B: External Cron Service
Use a service like:
- **Vercel Cron** (if you have a Vercel project)
- **GitHub Actions** (scheduled workflow)
- **Cron-job.org** (free external cron)
- **EasyCron** (paid external cron)

Example cron expression: `30 8 * * 1-5` (8:30 AM Monday-Friday)

The cron job should make a POST request to:
```
https://zqcbldgheimqrnqmbbed.supabase.co/functions/v1/send-morning-reminders
```

With headers:
```
Authorization: Bearer YOUR_SERVICE_ROLE_KEY
Content-Type: application/json
```

### Step 3: Verify Setup

1. **Test the function manually**:
   ```bash
   curl -X POST https://zqcbldgheimqrnqmbbed.supabase.co/functions/v1/send-morning-reminders \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json"
   ```

2. **Check the response**:
   - On weekdays: Should return `success: true` with count of users notified
   - On weekends: Should return `success: true` with message "Not a weekday, no reminders sent"

3. **Check notifications table**:
   ```sql
   SELECT * FROM notifications 
   WHERE type = 'system' 
   AND metadata->>'reminder_type' = 'morning_motivation'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

## How It Works

1. **Cron triggers** the Edge Function at 8:30 AM
2. **Function checks** if today is Monday-Friday
3. **If weekday**: Fetches all active users, picks random quote, creates notifications
4. **If weekend**: Exits early, no notifications created
5. **Existing triggers** on `notifications` table send emails/push notifications automatically

## Customization

### Change the Time
Update the cron schedule expression. Format: `minute hour * * day-of-week`
- `30 8 * * 1-5` = 8:30 AM Monday-Friday
- `0 9 * * 1-5` = 9:00 AM Monday-Friday

### Change the Quotes
Edit the `MOTIVATIONAL_QUOTES` array in `supabase/functions/send-morning-reminders/index.ts`

### Add User Preferences (Future Enhancement)
Add a column to `notification_preferences`:
```sql
ALTER TABLE notification_preferences 
ADD COLUMN morning_reminder_enabled BOOLEAN DEFAULT true;
```

Then update the Edge Function to only send to users where `morning_reminder_enabled = true`.

## Troubleshooting

- **Function not running**: Check cron schedule is set correctly
- **No notifications created**: Check function logs in Supabase Dashboard
- **Wrong timezone**: Adjust cron expression to match your timezone
- **Users not receiving emails**: Check notification preferences and email trigger setup
