-- ==========================================
-- Complete Diagnostic - Check Everything
-- ==========================================

-- 1. Check if user exists
SELECT 
  id,
  email,
  created_at
FROM auth.users
WHERE email = 'malikjcampbell05@gmail.com';

-- 2. Check if notification was created
SELECT 
  id,
  user_id,
  type,
  title,
  created_at
FROM notifications
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'malikjcampbell05@gmail.com')
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'notifications'
AND trigger_name = 'trigger_send_notification_email';

-- 4. Check pg_net extension
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') 
    THEN '✅ pg_net enabled'
    ELSE '❌ pg_net NOT enabled'
  END AS pg_net_status;

-- 5. Check function exists
SELECT 
  proname AS function_name,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%net.http_post%' 
    THEN '✅ Uses pg_net'
    ELSE '❌ Does NOT use pg_net'
  END AS uses_pg_net
FROM pg_proc
WHERE proname = 'send_notification_email';

-- 6. Test creating notification with detailed logging
DO $$
DECLARE
  test_user_id UUID;
  notification_id UUID;
BEGIN
  -- Get user
  SELECT id INTO test_user_id
  FROM auth.users
  WHERE email = 'malikjcampbell05@gmail.com';
  
  IF test_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found!';
  END IF;
  
  RAISE NOTICE 'User ID: %', test_user_id;
  
  -- Create notification
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (
    test_user_id,
    'system',
    'Diagnostic Test',
    'Testing trigger firing'
  )
  RETURNING id INTO notification_id;
  
  RAISE NOTICE 'Notification created: %', notification_id;
  RAISE NOTICE 'If trigger fired, check Edge Function logs now!';
END $$;









