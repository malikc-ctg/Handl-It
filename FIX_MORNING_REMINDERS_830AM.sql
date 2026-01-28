-- ============================================
-- FIX: Morning reminders → 8:30 AM Eastern
-- ============================================
-- The job was set to 8:30 UTC (3:30 AM Eastern).
-- This reschedules it to 13:30 UTC = 8:30 AM Eastern.
-- Run in Supabase Dashboard → SQL Editor
-- ============================================

SELECT cron.unschedule('morning-reminders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'morning-reminders'
);

SELECT cron.schedule(
  'morning-reminders',
  '30 13 * * 1-5',
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

SELECT 'Morning reminders rescheduled to 8:30 AM Eastern (Mon–Fri)' AS status;
