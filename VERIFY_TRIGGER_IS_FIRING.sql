-- ==========================================
-- Verify Trigger is Actually Firing
-- ==========================================

-- Check 1: Verify trigger exists and is enabled
SELECT 
  tgname AS trigger_name,
  tgenabled AS is_enabled,
  tgrelid::regclass AS table_name,
  pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgname = 'trigger_send_notification_email';

-- Check 2: Verify function exists
SELECT 
  proname AS function_name,
  prosrc AS function_source
FROM pg_proc
WHERE proname = 'send_notification_email'
LIMIT 1;

-- Check 3: Create a test with explicit trigger check
DO $$
DECLARE
  test_user_id UUID;
  notification_count_before INTEGER;
  notification_count_after INTEGER;
BEGIN
  -- Get user
  SELECT id INTO test_user_id
  FROM auth.users
  WHERE email = 'malikjcampbell05@gmail.com'
  LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found!';
  END IF;
  
  -- Count notifications before
  SELECT COUNT(*) INTO notification_count_before
  FROM notifications
  WHERE user_id = test_user_id;
  
  RAISE NOTICE 'Notifications before: %', notification_count_before;
  
  -- Create notification (trigger should fire)
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (
    test_user_id,
    'system',
    'Trigger Fire Test',
    'Testing if trigger fires automatically'
  );
  
  -- Count notifications after
  SELECT COUNT(*) INTO notification_count_after
  FROM notifications
  WHERE user_id = test_user_id;
  
  RAISE NOTICE 'Notifications after: %', notification_count_after;
  RAISE NOTICE 'Trigger should have fired. Check Edge Function logs NOW!';
  RAISE NOTICE 'If no logs appear, trigger is NOT firing.';
END $$;









