-- ==========================================
-- Verify Trigger Setup is Complete
-- ==========================================

-- 1. Check pg_net extension
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') 
    THEN '✅ pg_net enabled'
    ELSE '❌ pg_net NOT enabled - Run: CREATE EXTENSION IF NOT EXISTS pg_net;'
  END AS status;

-- 2. Check if function exists and show its definition
SELECT 
  proname AS function_name,
  pg_get_functiondef(oid) AS function_definition
FROM pg_proc 
WHERE proname = 'send_notification_email';

-- 3. Check if trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'notifications'
AND trigger_name = 'trigger_send_notification_email';

-- 4. If trigger doesn't exist, create it:
-- (Uncomment and run if needed)
/*
DROP TRIGGER IF EXISTS trigger_send_notification_email ON notifications;

CREATE TRIGGER trigger_send_notification_email
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_notification_email();

SELECT '✅ Trigger created!' AS status;
*/









