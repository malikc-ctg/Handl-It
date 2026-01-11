-- ==========================================
-- RECURRING BILLING: Automated Subscription Charges
-- ==========================================
-- Creates a scheduled job to automatically charge subscriptions
-- Runs daily to check for subscriptions due for payment

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Function to charge all due subscriptions
-- IDEMPOTENT: Uses current_period_end lock to prevent duplicate processing
-- SECURITY: Only processes subscriptions once per billing cycle
CREATE OR REPLACE FUNCTION charge_due_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  subscription_record RECORD;
  charged_count INTEGER := 0;
  failed_count INTEGER := 0;
  last_attempt_ts TIMESTAMPTZ;
  charge_cooldown_hours INTEGER := 24; -- Prevent duplicate charges within 24 hours
BEGIN
  -- Find all active subscriptions due for payment
  -- IDEMPOTENCY: Only process if not charged in last 24 hours (prevents duplicate cron runs)
  FOR subscription_record IN
    SELECT 
      ps.id,
      ps.company_id,
      ps.plan_name,
      ps.amount,
      ps.billing_cycle,
      ps.current_period_end,
      ps.gateway,
      cp.payment_gateway_account_id,
      cp.payment_gateway,
      cp.payment_gateway_connected,
      (ps.metadata->>'last_charge_attempt')::timestamptz as last_attempt
    FROM platform_subscriptions ps
    JOIN company_profiles cp ON cp.id = ps.company_id
    WHERE ps.status = 'active'
      AND ps.cancel_at_period_end = false
      AND ps.current_period_end <= NOW()
      -- IDEMPOTENCY CHECK: Skip if charged in last 24 hours
      AND (
        (ps.metadata->>'last_charge_attempt')::timestamptz IS NULL
        OR (ps.metadata->>'last_charge_attempt')::timestamptz < NOW() - (charge_cooldown_hours || ' hours')::interval
      )
      -- Prevent concurrent processing: only select if current_period_end hasn't been updated yet
      AND ps.current_period_end <= NOW()
    FOR UPDATE SKIP LOCKED -- Prevents concurrent processing of same subscription
  LOOP
    BEGIN
      -- IDEMPOTENCY: Update current_period_end first to prevent duplicate processing
      -- Calculate next billing period
      UPDATE platform_subscriptions
      SET 
        current_period_end = CASE
          WHEN billing_cycle = 'monthly' THEN current_period_end + INTERVAL '1 month'
          WHEN billing_cycle = 'yearly' THEN current_period_end + INTERVAL '1 year'
          ELSE current_period_end + INTERVAL '1 month' -- Default to monthly
        END,
        metadata = COALESCE(metadata, '{}'::jsonb) || 
          jsonb_build_object(
            'last_charge_attempt', NOW()::text,
            'charge_attempt_count', COALESCE((metadata->>'charge_attempt_count')::integer, 0) + 1,
            'charge_status', 'pending' -- Mark as pending until Edge Function confirms
          )
      WHERE id = subscription_record.id
        AND current_period_end <= NOW(); -- Double-check to prevent race conditions
      
      -- Only increment if row was actually updated (idempotency)
      IF FOUND THEN
        -- TODO: Call Edge Function to process actual payment
        -- supabase.functions.invoke('charge-subscription', { body: { subscription_id: subscription_record.id } })
        
        charged_count := charged_count + 1;
        
        -- Audit log (if audit_logs table exists)
        BEGIN
          INSERT INTO audit_logs (event_type, entity_type, entity_id, user_id, metadata)
          VALUES (
            'subscription_charge_initiated',
            'platform_subscription',
            subscription_record.id,
            NULL, -- System action
            jsonb_build_object(
              'amount', subscription_record.amount,
              'billing_cycle', subscription_record.billing_cycle,
              'gateway', subscription_record.gateway
            )
          );
        EXCEPTION WHEN OTHERS THEN
          -- Audit log table might not exist, ignore
          NULL;
        END;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      failed_count := failed_count + 1;
      -- Log error with full context
      RAISE WARNING 'Error charging subscription % (company_id: %): %', 
        subscription_record.id, 
        subscription_record.company_id, 
        SQLERRM;
      
      -- Update subscription with error
      UPDATE platform_subscriptions
      SET metadata = COALESCE(metadata, '{}'::jsonb) || 
          jsonb_build_object(
            'last_charge_error', SQLERRM,
            'last_charge_error_at', NOW()::text,
            'charge_status', 'failed'
          )
      WHERE id = subscription_record.id;
    END;
  END LOOP;
  
  RAISE NOTICE 'Subscription charge check completed: % processed, % failed', charged_count, failed_count;
END;
$$;

-- Schedule job to run daily at 9 AM UTC (adjust timezone as needed)
-- IDEMPOTENT: Function has built-in cooldown to prevent duplicate charges
-- If cron job runs multiple times, function will skip already-processed subscriptions
DO $$
BEGIN
  -- Only schedule if not already scheduled (idempotent cron scheduling)
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'charge-due-subscriptions'
  ) THEN
    PERFORM cron.schedule(
      'charge-due-subscriptions',
      '0 9 * * *', -- Every day at 9 AM UTC
      $cron$
      SELECT charge_due_subscriptions();
      $cron$
    );
    RAISE NOTICE 'Cron job "charge-due-subscriptions" scheduled successfully';
  ELSE
    RAISE NOTICE 'Cron job "charge-due-subscriptions" already exists, skipping';
  END IF;
END $$;

-- Also create a function that can be called manually
CREATE OR REPLACE FUNCTION trigger_subscription_charges()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Call the charge function
  PERFORM charge_due_subscriptions();
  
  -- Return summary
  SELECT jsonb_build_object(
    'status', 'success',
    'message', 'Subscription charge check completed',
    'timestamp', NOW()
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION charge_due_subscriptions() TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_subscription_charges() TO authenticated;

-- ==========================================
-- PAYMENT FAILURE HANDLING
-- ==========================================

-- Function to handle payment failures
CREATE OR REPLACE FUNCTION handle_subscription_payment_failure(
  subscription_id_param UUID,
  error_message TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  subscription_record RECORD;
  attempt_count INTEGER;
  grace_period_days INTEGER := 7;
BEGIN
  -- Get subscription details
  SELECT 
    *,
    COALESCE((metadata->>'payment_failure_count')::integer, 0) as failure_count
  INTO subscription_record
  FROM platform_subscriptions
  WHERE id = subscription_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;
  
  attempt_count := subscription_record.failure_count + 1;
  
  -- Update subscription with failure info
  UPDATE platform_subscriptions
  SET 
    status = CASE
      WHEN attempt_count >= 3 THEN 'unpaid' -- After 3 failures, mark as unpaid
      ELSE 'past_due'
    END,
    metadata = COALESCE(metadata, '{}'::jsonb) || 
      jsonb_build_object(
        'payment_failure_count', attempt_count,
        'last_payment_failure', NOW()::text,
        'last_payment_error', error_message,
        'grace_period_end', (NOW() + (grace_period_days || ' days')::interval)::text
      )
  WHERE id = subscription_id_param;
  
  -- After 3 failures, suspend access (you can add more logic here)
  IF attempt_count >= 3 THEN
    -- Log for admin review
    RAISE NOTICE 'Subscription % has failed payment 3 times. Suspending access.', subscription_id_param;
  END IF;
END;
$$;

-- Function to retry failed payments
CREATE OR REPLACE FUNCTION retry_failed_payments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  subscription_record RECORD;
  retried_count INTEGER := 0;
  result jsonb;
BEGIN
  -- Find subscriptions that are past_due but within grace period
  FOR subscription_record IN
    SELECT *
    FROM platform_subscriptions
    WHERE status = 'past_due'
      AND metadata->>'grace_period_end' IS NOT NULL
      AND (metadata->>'grace_period_end')::timestamptz > NOW()
      AND COALESCE((metadata->>'payment_failure_count')::integer, 0) < 3
  LOOP
    BEGIN
      -- Mark for retry (actual retry happens via Edge Function)
      UPDATE platform_subscriptions
      SET metadata = COALESCE(metadata, '{}'::jsonb) || 
          jsonb_build_object('retry_attempt', NOW()::text)
      WHERE id = subscription_record.id;
      
      retried_count := retried_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error retrying subscription %: %', subscription_record.id, SQLERRM;
    END;
  END LOOP;
  
  SELECT jsonb_build_object(
    'status', 'success',
    'retried_count', retried_count,
    'timestamp', NOW()
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Schedule retry job (runs every 3 days for past_due subscriptions)
SELECT cron.schedule(
  'retry-failed-payments',
  '0 10 */3 * *', -- Every 3 days at 10 AM UTC
  $$
  SELECT retry_failed_payments();
  $$
);

-- Grant permissions
GRANT EXECUTE ON FUNCTION handle_subscription_payment_failure(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION retry_failed_payments() TO authenticated;

