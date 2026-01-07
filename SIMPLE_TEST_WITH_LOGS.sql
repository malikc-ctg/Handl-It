-- ==========================================
-- Simple Test with Full Logging
-- Run this and check the messages/notifications tab
-- ==========================================

DO $$
DECLARE
  test_user_id UUID;
  notification_id UUID;
  user_email TEXT;
BEGIN
  -- Get user
  SELECT id, email INTO test_user_id, user_email
  FROM auth.users
  WHERE email = 'malikjcampbell05@gmail.com'
  LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found!';
  END IF;
  
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'TEST STARTING';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'User ID: %', test_user_id;
  RAISE NOTICE 'User Email: %', user_email;
  RAISE NOTICE 'Creating notification now...';
  
  -- Create notification (this should trigger the trigger)
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    test_user_id,
    'system',
    '🎉 Email Test Notification',
    'This is a test. If you see this email, everything is working!',
    'https://nfgone.ca'
  )
  RETURNING id INTO notification_id;
  
  RAISE NOTICE '✅ Notification created: %', notification_id;
  RAISE NOTICE '✅ Trigger should have fired automatically';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'NOW CHECK:';
  RAISE NOTICE '1. Edge Function logs (Supabase → Functions → send-notification-email → Logs)';
  RAISE NOTICE '2. Resend Dashboard → Logs';
  RAISE NOTICE '3. Your email: malikjcampbell05@gmail.com';
  RAISE NOTICE '==========================================';
  
END $$;

-- Verify notification was created
SELECT 
  id,
  user_id,
  type,
  title,
  created_at,
  (SELECT email FROM auth.users WHERE id = notifications.user_id) AS user_email
FROM notifications
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'malikjcampbell05@gmail.com')
ORDER BY created_at DESC
LIMIT 1;









