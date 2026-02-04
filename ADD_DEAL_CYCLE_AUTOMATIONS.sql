-- ============================================
-- Deal cycle outreach automations & reminders
-- New rule types: callback due, walkthrough today, quote expiring
-- Run after ADD_WORKFLOW_AUTOMATIONS_SCHEMA.sql
-- ============================================

-- 1. Allow new rule types (drop and re-add check constraint)
ALTER TABLE workflow_automation_rules
  DROP CONSTRAINT IF EXISTS workflow_automation_rules_rule_type_check;

ALTER TABLE workflow_automation_rules
  ADD CONSTRAINT workflow_automation_rules_rule_type_check
  CHECK (rule_type IN (
    'auto_assign_jobs',
    'escalate_overdue',
    'job_due_reminders',
    'deal_follow_up_reminders',
    'deal_callback_reminders',
    'deal_walkthrough_reminders',
    'deal_quote_expiring_reminders'
  ));

-- 2. Ensure deals has next_action_date, next_action_type (for automation)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'next_action_date') THEN
    ALTER TABLE deals ADD COLUMN next_action_date TIMESTAMPTZ;
    RAISE NOTICE 'Added deals.next_action_date';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'next_action_type') THEN
    ALTER TABLE deals ADD COLUMN next_action_type TEXT;
    RAISE NOTICE 'Added deals.next_action_type';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_deals_next_action_date ON deals(next_action_date) WHERE next_action_date IS NOT NULL;

-- 3. Insert default deal-cycle reminder rules (if not present)
INSERT INTO workflow_automation_rules (name, rule_type, enabled, config)
SELECT 'Callback due / overdue reminder', 'deal_callback_reminders', true, '{"notify_assigned": true, "send_push": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM workflow_automation_rules WHERE rule_type = 'deal_callback_reminders');

INSERT INTO workflow_automation_rules (name, rule_type, enabled, config)
SELECT 'Walkthrough today reminder', 'deal_walkthrough_reminders', true, '{"notify_assigned": true, "send_push": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM workflow_automation_rules WHERE rule_type = 'deal_walkthrough_reminders');

INSERT INTO workflow_automation_rules (name, rule_type, enabled, config)
SELECT 'Quote expiring soon (48h)', 'deal_quote_expiring_reminders', true, '{"hours_before": 48, "notify_assigned": true, "send_push": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM workflow_automation_rules WHERE rule_type = 'deal_quote_expiring_reminders');

-- 4. Schedule the workflow (if not already): call run-workflow-automations daily or every few hours
--    e.g. Supabase cron: 0 8 * * * (8am daily) with header X-Cron-Secret: <CRON_SECRET>

SELECT 'Deal cycle automations ready' AS status;
