-- ============================================
-- SETUP MORNING REMINDERS CRON SCHEDULE
-- ============================================
-- This sets up a cron job to run the morning reminders Edge Function
-- at 8:30 AM Monday-Friday
-- ============================================
-- Note: This requires the pg_cron extension to be enabled in Supabase
-- If pg_cron is not available, use an external cron service instead
-- ============================================

-- Check if pg_cron extension is available
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE '⚠️ pg_cron extension not found. You may need to enable it in Supabase Dashboard → Database → Extensions';
    RAISE NOTICE 'Alternatively, use an external cron service (see MORNING_REMINDERS_SETUP.md)';
  END IF;
END $$;

-- Drop existing cron job if it exists
SELECT cron.unschedule('morning-reminders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'morning-reminders'
);

-- Schedule the morning reminders function
-- Cron uses UTC. We use 13:30 UTC = 8:30 AM Eastern (EST/EDT).
-- Other timezones (all 8:30 AM local):
--   PST (UTC-8): '30 16 * * 1-5'
--   CST (UTC-6): '30 14 * * 1-5'
--   UTC:        '30 8 * * 1-5'

-- Note: Replace YOUR_ANON_KEY below with your actual Supabase anon key
-- You can find it in Supabase Dashboard → Settings → API → anon/public key
-- The function is public and doesn't require service role key to call it

SELECT cron.schedule(
  'morning-reminders',                    -- Job name
  '30 13 * * 1-5',                        -- Cron schedule: 8:30 AM Eastern Mon–Fri (13:30 UTC)
  $$                                      -- SQL to execute
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

-- Verify the cron job was created
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
WHERE jobname = 'morning-reminders';

-- Success message
SELECT '✅ Morning reminders cron job scheduled!' AS status;
SELECT '📅 Schedule: 8:30 AM Eastern (Mon–Fri)' AS schedule;
SELECT '⚠️  Note: Uses 13:30 UTC. Adjust cron if you use another timezone.' AS note;
SELECT '🔗 Edge Function: send-morning-reminders' AS function_name;
