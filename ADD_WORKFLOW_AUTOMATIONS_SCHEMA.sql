-- ============================================
-- WORKFLOW AUTOMATIONS SCHEMA
-- ============================================
-- Tables for configurable workflow rules and automation run logs
-- Run in Supabase SQL Editor
-- ============================================

-- 1. Workflow automation rules (configurable by admins)
CREATE TABLE IF NOT EXISTS workflow_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Rule identity
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'auto_assign_jobs',
    'escalate_overdue',
    'job_due_reminders',
    'deal_follow_up_reminders'
  )),
  enabled BOOLEAN DEFAULT true,
  
  -- Config (JSON, varies by rule_type)
  -- auto_assign_jobs: { "strategy": "site_based" | "round_robin" | "least_workload", "assign_on": "create" | "daily" }
  -- escalate_overdue: { "notify_assigned": true, "notify_admins": true, "days_overdue": 1 }
  -- job_due_reminders: { "days_before": [1], "hours_before": [24], "notify_assigned": true }
  -- deal_follow_up_reminders: { "days_without_touch": 3, "stages": ["qualification","proposal"], "notify_assigned": true }
  config JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Automation run log (audit trail)
CREATE TABLE IF NOT EXISTS workflow_automation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  rule_type TEXT NOT NULL,
  rule_id UUID REFERENCES workflow_automation_rules(id) ON DELETE SET NULL,
  
  -- What happened
  action TEXT NOT NULL,  -- e.g. 'auto_assigned', 'overdue_notified', 'reminder_sent'
  entity_type TEXT NOT NULL,  -- 'job', 'deal'
  entity_id TEXT,  -- UUID as text for flexibility
  
  -- Details
  details JSONB DEFAULT '{}',  -- e.g. { "assigned_to": "...", "reason": "site_based" }
  message TEXT,  -- Human-readable log message
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_rules_type ON workflow_automation_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_workflow_rules_enabled ON workflow_automation_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_workflow_log_rule_type ON workflow_automation_log(rule_type);
CREATE INDEX IF NOT EXISTS idx_workflow_log_created_at ON workflow_automation_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_log_entity ON workflow_automation_log(entity_type, entity_id);

-- RLS
ALTER TABLE workflow_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_automation_log ENABLE ROW LEVEL SECURITY;

-- Admins can manage rules; all authenticated can read
CREATE POLICY "Admins can manage workflow rules" ON workflow_automation_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "Authenticated can view workflow rules" ON workflow_automation_rules
  FOR SELECT USING (auth.role() = 'authenticated');

-- Log is append-only by service role; authenticated can read
CREATE POLICY "Service role can insert automation log" ON workflow_automation_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated can view automation log" ON workflow_automation_log
  FOR SELECT USING (auth.role() = 'authenticated');

GRANT ALL ON workflow_automation_rules TO authenticated;
GRANT ALL ON workflow_automation_log TO authenticated;
GRANT ALL ON workflow_automation_log TO service_role;

-- Insert default rules (can be toggled off)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workflow_automation_rules WHERE rule_type = 'auto_assign_jobs') THEN
    INSERT INTO workflow_automation_rules (name, rule_type, enabled, config) VALUES
      ('Auto-assign unassigned jobs by site', 'auto_assign_jobs', true, '{"strategy": "site_based", "assign_on": "daily"}'::jsonb),
      ('Escalate overdue jobs', 'escalate_overdue', true, '{"notify_assigned": true, "notify_admins": true, "days_overdue": 1}'::jsonb),
      ('Job due tomorrow reminder', 'job_due_reminders', true, '{"days_before": [1], "notify_assigned": true}'::jsonb),
      ('Deal follow-up reminder (no touch 3+ days)', 'deal_follow_up_reminders', true, '{"days_without_touch": 3, "stages": ["qualification", "proposal", "negotiation"], "notify_assigned": true}'::jsonb);
    RAISE NOTICE 'Default workflow rules inserted';
  END IF;
END $$;

SELECT 'Workflow automations schema ready' AS status;
