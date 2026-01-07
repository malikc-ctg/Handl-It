-- ==========================================
-- Test Email Notification for malikjcampbell05@gmail.com
-- ==========================================

DO $$
DECLARE
  test_user_id UUID;
  test_email TEXT;
BEGIN
  -- Find user with this email
  SELECT id, email INTO test_user_id, test_email
  FROM auth.users
  WHERE email = 'malikjcampbell05@gmail.com'
  LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE EXCEPTION '❌ User with email malikjcampbell05@gmail.com not found in auth.users';
  END IF;
  
  RAISE NOTICE '✅ Found user: % (email: %)', test_user_id, test_email;
  RAISE NOTICE '📧 Creating test notification...';
  
  -- Create test notification
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    test_user_id,
    'system',
    '🎉 Test Email Notification',
    'This is a test email notification. If you received this, email notifications are working perfectly!',
    'https://nfgone.ca'
  );
  
  RAISE NOTICE '✅ Test notification created!';
  RAISE NOTICE '📧 Email should be sent to: malikjcampbell05@gmail.com';
  RAISE NOTICE '📋 Check: 1) Edge Function logs 2) Resend logs 3) Your email inbox (and spam!)';
END $$;

-- Verify notification was created
SELECT 
  id,
  user_id,
  type,
  title,
  message,
  created_at,
  (SELECT email FROM auth.users WHERE id = notifications.user_id) AS user_email
FROM notifications
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'malikjcampbell05@gmail.com')
ORDER BY created_at DESC
LIMIT 1;









