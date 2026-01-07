-- ==========================================
-- COMPLETE EMAIL NOTIFICATION FIX
-- Run this ENTIRE script in Supabase SQL Editor
-- It fixes everything at once!
-- ==========================================

-- Step 1: Enable pg_net extension (REQUIRED)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Add link column if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    AND column_name = 'link'
  ) THEN
    ALTER TABLE notifications ADD COLUMN link VARCHAR(500);
  END IF;
END $$;

-- Step 3: Fix foreign key constraint (point to auth.users, not profiles)
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

ALTER TABLE notifications 
ADD CONSTRAINT notifications_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Step 4: Create/Update the function to send notification emails
CREATE OR REPLACE FUNCTION send_notification_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  -- Only send if we have email
  IF user_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get Edge Function URL
  edge_function_url := 'https://zqcbldgheimqrnqmbbed.supabase.co/functions/v1/send-notification-email';
  
  -- Use anon key (Edge Function uses service role from secrets internally)
  service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxY2JsZGdoZWltcXJucW1iYmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MDM5NjIsImV4cCI6MjA3NjI3OTk2Mn0.UYlnTQeCjNLed6g9oNRLQIXD69OgzRrXupl3LXUvh4I';

  -- Call Edge Function asynchronously using pg_net
  BEGIN
    PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'notification', jsonb_build_object(
          'id', NEW.id,
          'user_id', NEW.user_id,
          'type', NEW.type,
          'title', NEW.title,
          'message', NEW.message,
          'link', COALESCE(NEW.link, NULL),
          'metadata', COALESCE(NEW.metadata, '{}'::jsonb)
        ),
        'user_email', user_email
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- If pg_net fails, log warning but don't fail the notification creation
    RAISE WARNING 'Failed to send notification email: %. Notification was still created.', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Step 5: Drop and recreate trigger
DROP TRIGGER IF EXISTS trigger_send_notification_email ON notifications;

CREATE TRIGGER trigger_send_notification_email
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_notification_email();

-- Step 6: Test - Create a test notification automatically
DO $$
DECLARE
  test_user_id UUID;
  test_email TEXT;
BEGIN
  -- Get first user
  SELECT id, email INTO test_user_id, test_email
  FROM auth.users
  LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    -- Create test notification
    INSERT INTO notifications (user_id, type, title, message)
    VALUES (
      test_user_id,
      'system',
      '✅ Email Setup Complete!',
      'This is a test notification. If you received this email, everything is working! 🎉'
    );
    
    RAISE NOTICE '✅ Test notification created for user: % (email: %)', test_user_id, test_email;
    RAISE NOTICE '📧 Check your email inbox and Edge Function logs!';
  ELSE
    RAISE NOTICE '⚠️ No users found. Create a user first, then test again.';
  END IF;
END $$;

-- Success message
SELECT '✅ COMPLETE! Email notifications are now set up!' AS status;
SELECT '📧 Check: 1) Edge Function logs 2) Resend logs 3) Your email inbox' AS next_steps;









