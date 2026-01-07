-- ==========================================
-- Check if Trigger is Actually Firing
-- ==========================================

-- Check 1: Verify trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'notifications';

-- Check 2: See recent notifications
SELECT 
  id,
  user_id,
  type,
  title,
  created_at,
  (SELECT email FROM auth.users WHERE id = notifications.user_id) AS user_email
FROM notifications
ORDER BY created_at DESC
LIMIT 10;

-- Check 3: Check if pg_net extension is enabled
SELECT 
  extname,
  extversion
FROM pg_extension
WHERE extname = 'pg_net';

-- Check 4: Verify function exists
SELECT 
  proname,
  pg_get_functiondef(oid) LIKE '%net.http_post%' AS uses_pg_net
FROM pg_proc
WHERE proname = 'send_notification_email';









