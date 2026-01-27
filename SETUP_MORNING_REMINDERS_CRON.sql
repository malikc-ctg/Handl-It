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
-- Cron expression: '30 8 * * 1-5' = 8:30 AM Monday-Friday (UTC)
-- Adjust time based on your timezone:
--   EST (UTC-5): '30 13 * * 1-5' (1:30 PM UTC = 8:30 AM EST)
--   PST (UTC-8): '30 16 * * 1-5' (4:30 PM UTC = 8:30 AM PST)
--   CST (UTC-6): '30 14 * * 1-5' (2:30 PM UTC = 8:30 AM CST)

SELECT cron.schedule(
  'morning-reminders',                    -- Job name
  '30 8 * * 1-5',                         -- Cron schedule: 8:30 AM Monday-Friday (UTC)
  $$                                      -- SQL to execute
  SELECT net.http_post(
    url := 'https://zqcbldgheimqrnqmbbed.supabase.co/functions/v1/send-morning-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
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
SELECT '📅 Schedule: 8:30 AM Monday-Friday (UTC)' AS schedule;
SELECT '⚠️  Note: Adjust timezone in cron expression if needed' AS note;
SELECT '🔗 Edge Function: send-morning-reminders' AS function_name;
