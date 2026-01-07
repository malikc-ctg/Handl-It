-- ==========================================
-- Debug: Add Logging to Trigger Function
-- This will help us see if trigger is firing
-- ==========================================

-- Create a logging function to see if trigger fires
CREATE OR REPLACE FUNCTION send_notification_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
  edge_function_url TEXT;
  service_role_key TEXT;
  http_result INTEGER;
BEGIN
  -- Log that trigger fired
  RAISE NOTICE '🔔 Trigger fired! Creating notification: % for user: %', NEW.id, NEW.user_id;
  
  -- Get user email
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  -- Log email
  RAISE NOTICE '📧 User email: %', user_email;

  -- Only send if we have email
  IF user_email IS NULL THEN
    RAISE NOTICE '⚠️ No email found for user, skipping email send';
    RETURN NEW;
  END IF;

  -- Get Edge Function URL
  edge_function_url := 'https://zqcbldgheimqrnqmbbed.supabase.co/functions/v1/send-notification-email';
  
  -- Use anon key
  service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxY2JsZGdoZWltcXJucW1iYmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MDM5NjIsImV4cCI6MjA3NjI3OTk2Mn0.UYlnTQeCjNLed6g9oNRLQIXD69OgzRrXupl3LXUvh4I';

  RAISE NOTICE '📤 Calling Edge Function: %', edge_function_url;

  -- Call Edge Function asynchronously using pg_net
  BEGIN
    SELECT net.http_post(
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
    ) INTO http_result;
    
    RAISE NOTICE '✅ HTTP POST call initiated. Request ID: %', http_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- If pg_net fails, log the error
    RAISE WARNING '❌ Failed to send notification email: %. Notification was still created.', SQLERRM;
    RAISE NOTICE 'Full error details: %', SQLERRM;
  END;

  RAISE NOTICE '✅ Trigger completed for notification: %', NEW.id;
  RETURN NEW;
END;
$$;

-- Verify trigger is still attached
SELECT 'Trigger function updated with logging. Now test by creating a notification.' AS status;









