-- ==========================================
-- Final Test - Check Everything
-- Run this and check ALL the logs mentioned
-- ==========================================

DO $$
DECLARE
  test_user_id UUID;
  notification_id UUID;
BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'STARTING TEST - Check all logs below';
  RAISE NOTICE '==========================================';
  
  -- Get user
  SELECT id INTO test_user_id
  FROM auth.users
  WHERE email = 'malikjcampbell05@gmail.com'
  LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found!';
  END IF;
  
  RAISE NOTICE 'User ID: %', test_user_id;
  RAISE NOTICE 'Creating notification NOW...';
  RAISE NOTICE 'Trigger should fire automatically...';
  
  -- Create notification
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    test_user_id,
    'system',
    '🚀 Final Test Notification',
    'This is a final test. If you receive this email, everything is working!',
    'https://nfgone.ca'
  )
  RETURNING id INTO notification_id;
  
  RAISE NOTICE '✅ Notification created: %', notification_id;
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'NOW CHECK THESE 3 PLACES:';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '1. Edge Function Logs:';
  RAISE NOTICE '   Supabase → Functions → send-notification-email → Logs tab';
  RAISE NOTICE '   Look for NEW entries after this test';
  RAISE NOTICE '';
  RAISE NOTICE '2. Resend Dashboard → Logs';
  RAISE NOTICE '   Look for email to malikjcampbell05@gmail.com';
  RAISE NOTICE '';
  RAISE NOTICE '3. Your email inbox';
  RAISE NOTICE '   Check malikjcampbell05@gmail.com (and spam)';
  RAISE NOTICE '==========================================';
  
END $$;

-- Show the notification that was created
SELECT 
  id,
  type,
  title,
  created_at
FROM notifications
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'malikjcampbell05@gmail.com')
ORDER BY created_at DESC
LIMIT 1;









