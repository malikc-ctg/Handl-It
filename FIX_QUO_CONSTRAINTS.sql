-- ============================================
-- FIX: Add missing unique constraints for Quo
-- ============================================

-- Add unique constraint on quo_webhook_logs.webhook_id
ALTER TABLE quo_webhook_logs 
DROP CONSTRAINT IF EXISTS quo_webhook_logs_webhook_id_key;

ALTER TABLE quo_webhook_logs 
ADD CONSTRAINT quo_webhook_logs_webhook_id_key UNIQUE (webhook_id);

-- Ensure calls.quo_call_id has unique constraint (for upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'calls_quo_call_id_key'
  ) THEN
    ALTER TABLE calls ADD CONSTRAINT calls_quo_call_id_key UNIQUE (quo_call_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists, ignore
  NULL;
END $$;

SELECT 'Quo constraints fixed!' AS status;
