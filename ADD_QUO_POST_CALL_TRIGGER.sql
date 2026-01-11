-- ============================================
-- Quo Post-Call Workflow Automatic Trigger
-- ============================================
-- Automatically triggers post-call workflow processing
-- when a call transcript is received or call is completed
-- ============================================

-- Function to call the post-call workflow Edge Function
CREATE OR REPLACE FUNCTION trigger_quo_post_call_workflow()
RETURNS TRIGGER AS $$
DECLARE
  function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Only process if call is completed and has transcript or summary
  IF (NEW.status = 'completed' OR NEW.outcome = 'answered') 
     AND (NEW.transcript IS NOT NULL OR NEW.summary IS NOT NULL)
     AND (OLD.transcript IS NULL AND OLD.summary IS NULL) THEN
    
    -- Get Edge Function URL and service role key from environment
    -- Note: In production, these should be stored securely
    function_url := current_setting('app.quo_post_call_workflow_url', true);
    service_role_key := current_setting('app.supabase_service_role_key', true);
    
    -- If not set, use default (adjust to your project)
    IF function_url IS NULL OR function_url = '' THEN
      function_url := 'https://zqcbldgheimqrnqmbbed.supabase.co/functions/v1/quo-post-call-workflow';
    END IF;
    
    -- Call the Edge Function asynchronously via pg_net
    -- This requires the pg_net extension
    PERFORM net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
      ),
      body := jsonb_build_object('callId', NEW.id::text)
    );
    
    -- Log the trigger
    INSERT INTO call_events (call_id, event_type, event_data)
    VALUES (
      NEW.id,
      'post_call_workflow_triggered',
      jsonb_build_object('triggered_at', NOW())
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trg_quo_post_call_workflow ON calls;

-- Create trigger
CREATE TRIGGER trg_quo_post_call_workflow
  AFTER UPDATE ON calls
  FOR EACH ROW
  WHEN (
    (OLD.transcript IS NULL AND NEW.transcript IS NOT NULL)
    OR (OLD.summary IS NULL AND NEW.summary IS NOT NULL)
    OR (OLD.status != 'completed' AND NEW.status = 'completed')
  )
  EXECUTE FUNCTION trigger_quo_post_call_workflow();

-- Alternative: Use Supabase Edge Function HTTP call
-- If pg_net is not available, you can use a simpler approach
-- that logs the event and processes it via a scheduled function

-- Success notice
DO $$
BEGIN
  RAISE NOTICE '✅ Post-call workflow trigger created successfully.';
  RAISE NOTICE '📋 Note: Make sure pg_net extension is enabled and';
  RAISE NOTICE '    set app.quo_post_call_workflow_url and app.supabase_service_role_key';
  RAISE NOTICE '    in your database settings if using automatic triggering.';
END $$;
