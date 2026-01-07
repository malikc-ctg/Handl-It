-- ==========================================
-- Easy Trigger Test - Just Run This!
-- ==========================================

-- This will automatically get a user and create a test notification
DO $$
DECLARE
  test_user_id UUID;
  test_email TEXT;
BEGIN
  -- Get first user
  SELECT id, email INTO test_user_id, test_email
  FROM auth.users
  LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found in auth.users';
  END IF;
  
  RAISE NOTICE 'Creating test notification for user: % (email: %)', test_user_id, test_email;
  
  -- Create test notification
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (
    test_user_id,
    'system',
    'Test Email Notification',
    'This is a test to verify email notifications are working'
  );
  
  RAISE NOTICE '✅ Test notification created!';
  RAISE NOTICE '📧 Check Edge Function logs: Supabase → Edge Functions → send-notification-email → Logs';
  RAISE NOTICE '📧 Check Resend Dashboard → Logs';
  RAISE NOTICE '📧 Check your email inbox for: %', test_email;
END $$;









