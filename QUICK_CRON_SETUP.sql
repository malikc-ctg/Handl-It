-- ============================================
-- QUICK SETUP: Morning Reminders Cron
-- ============================================
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- Enable pg_cron extension (if available)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing job if it exists
SELECT cron.unschedule('morning-reminders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'morning-reminders'
);

-- Schedule morning reminders at 8:30 AM Monday-Friday (UTC)
-- For EST: Change '30 8' to '30 13' (8:30 AM EST = 1:30 PM UTC)
-- For PST: Change '30 8' to '30 16' (8:30 AM PST = 4:30 PM UTC)
SELECT cron.schedule(
  'morning-reminders',
  '30 8 * * 1-5',  -- 8:30 AM Monday-Friday UTC
  $$
  SELECT net.http_post(
    url := 'https://zqcbldgheimqrnqmbbed.supabase.co/functions/v1/send-morning-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxY2JsZGdoZWltcXJucW1iYmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MDM5NjIsImV4cCI6MjA3NjI3OTk2Mn0.UYlnTQeCjNLed6g9oNRLQIXD69OgzRrXupl3LXUvh4I'
    )::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Verify it was created
SELECT jobid, schedule, active FROM cron.job WHERE jobname = 'morning-reminders';

SELECT '✅ Morning reminders cron scheduled for 8:30 AM Monday-Friday (UTC)' AS status;
