-- ============================================
-- SEED DATA FOR CORE SALES CRM SCHEMA
-- ============================================
-- Inserts default deal stages and enum seed values
-- Run this AFTER CORE_SALES_CRM_SCHEMA.sql
-- ============================================

BEGIN;

-- ============================================
-- SEED DEFAULT DEAL STAGES
-- ============================================
-- These are workspace-agnostic default stages
-- Individual workspaces can create custom stages

INSERT INTO deal_stages (workspace_id, stage_name, stage_enum, display_order, probability, is_active)
VALUES
  (NULL, 'Prospecting', 'prospecting', 1, 10, TRUE),
  (NULL, 'Qualification', 'qualification', 2, 25, TRUE),
  (NULL, 'Proposal', 'proposal', 3, 50, TRUE),
  (NULL, 'Negotiation', 'negotiation', 4, 75, TRUE),
  (NULL, 'Closed Won', 'closed_won', 5, 100, TRUE),
  (NULL, 'Closed Lost', 'closed_lost', 6, 0, TRUE)
ON CONFLICT (workspace_id, stage_enum) DO NOTHING;

-- ============================================
-- SEED FUNCTION: Create default stages for workspace
-- ============================================

CREATE OR REPLACE FUNCTION seed_workspace_deal_stages(p_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Copy default stages to workspace
  INSERT INTO deal_stages (workspace_id, stage_name, stage_enum, display_order, probability, is_active)
  SELECT 
    p_workspace_id,
    stage_name,
    stage_enum,
    display_order,
    probability,
    is_active
  FROM deal_stages
  WHERE workspace_id IS NULL -- Default stages
  ON CONFLICT (workspace_id, stage_enum) DO NOTHING;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION seed_workspace_deal_stages(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION seed_workspace_deal_stages(UUID) TO service_role;

-- ============================================
-- HELPER FUNCTIONS FOR ENUMS
-- ============================================

-- Function to get all valid lead statuses
CREATE OR REPLACE FUNCTION get_lead_statuses()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN ARRAY['new', 'contacted', 'qualified', 'unqualified', 'converted', 'nurturing'];
END;
$$;

-- Function to get all valid deal stages
CREATE OR REPLACE FUNCTION get_deal_stages()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN ARRAY['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
END;
$$;

-- Function to get all valid deal health values
CREATE OR REPLACE FUNCTION get_deal_health_values()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN ARRAY['at_risk', 'on_track', 'exceeding', 'needs_attention'];
END;
$$;

-- Function to get all valid lost reasons
CREATE OR REPLACE FUNCTION get_lost_reasons()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN ARRAY['price_too_high', 'competitor', 'no_decision', 'budget_cut', 'timing_not_right', 'features_missing', 'other'];
END;
$$;

-- Function to get all valid contact roles
CREATE OR REPLACE FUNCTION get_contact_roles()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN ARRAY['decision_maker', 'influencer', 'gatekeeper', 'user', 'champion', 'other'];
END;
$$;

-- Function to get all valid call outcomes
CREATE OR REPLACE FUNCTION get_call_outcomes()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN ARRAY['connected', 'no_answer', 'voicemail', 'busy', 'failed', 'cancelled', 'missed'];
END;
$$;

-- Function to get all valid message statuses
CREATE OR REPLACE FUNCTION get_message_statuses()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN ARRAY['pending', 'sent', 'delivered', 'read', 'failed', 'bounced'];
END;
$$;

-- Function to get all valid task statuses
CREATE OR REPLACE FUNCTION get_task_statuses()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN ARRAY['pending', 'in_progress', 'completed', 'cancelled', 'deferred'];
END;
$$;

-- Function to get all valid task types
CREATE OR REPLACE FUNCTION get_task_types()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN ARRAY['call', 'email', 'meeting', 'follow_up', 'quote_preparation', 'proposal_review', 'other'];
END;
$$;

-- Function to get all valid door visit outcomes
CREATE OR REPLACE FUNCTION get_door_visit_outcomes()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN ARRAY['met', 'not_home', 'refused', 'left_info', 'follow_up_scheduled', 'not_interested'];
END;
$$;

-- Function to get all valid property types
CREATE OR REPLACE FUNCTION get_property_types()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN ARRAY['residential', 'commercial', 'industrial', 'retail', 'office', 'mixed_use', 'other'];
END;
$$;

-- Function to get all valid route statuses
CREATE OR REPLACE FUNCTION get_route_statuses()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN ARRAY['planned', 'in_progress', 'completed', 'cancelled'];
END;
$$;

-- Grant execute on all helper functions
GRANT EXECUTE ON FUNCTION get_lead_statuses() TO authenticated;
GRANT EXECUTE ON FUNCTION get_deal_stages() TO authenticated;
GRANT EXECUTE ON FUNCTION get_deal_health_values() TO authenticated;
GRANT EXECUTE ON FUNCTION get_lost_reasons() TO authenticated;
GRANT EXECUTE ON FUNCTION get_contact_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION get_call_outcomes() TO authenticated;
GRANT EXECUTE ON FUNCTION get_message_statuses() TO authenticated;
GRANT EXECUTE ON FUNCTION get_task_statuses() TO authenticated;
GRANT EXECUTE ON FUNCTION get_task_types() TO authenticated;
GRANT EXECUTE ON FUNCTION get_door_visit_outcomes() TO authenticated;
GRANT EXECUTE ON FUNCTION get_property_types() TO authenticated;
GRANT EXECUTE ON FUNCTION get_route_statuses() TO authenticated;

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Active deals summary
CREATE OR REPLACE VIEW active_deals_summary AS
SELECT 
  d.id,
  d.workspace_id,
  d.title,
  d.stage,
  d.value_estimate,
  d.health,
  d.assigned_user_id,
  d.last_touch_at,
  d.expected_close_date,
  l.source as lead_source,
  c.full_name as primary_contact_name,
  c.email as primary_contact_email,
  c.normalized_phone as primary_contact_phone
FROM deals d
LEFT JOIN leads l ON l.id = d.lead_id
LEFT JOIN contacts c ON c.id = l.primary_contact_id
WHERE d.stage NOT IN ('closed_won', 'closed_lost');

-- View: Quote summary with line items
CREATE OR REPLACE VIEW quote_summary AS
SELECT 
  q.id,
  q.deal_id,
  q.quote_version,
  q.variant,
  q.status,
  q.total_amount,
  q.currency,
  q.created_at,
  q.sent_at,
  q.viewed_at,
  q.accepted_at,
  COUNT(qli.id) as line_item_count,
  SUM(qli.quantity) as total_quantity,
  SUM(qli.total) as calculated_total
FROM quotes q
LEFT JOIN quote_line_items qli ON qli.quote_id = q.id
GROUP BY q.id, q.deal_id, q.quote_version, q.variant, q.status, 
         q.total_amount, q.currency, q.created_at, q.sent_at, 
         q.viewed_at, q.accepted_at;

-- View: Recent activity (last 30 days)
-- Check if required columns exist before creating view
DO $$
BEGIN
  -- Only create view if all required tables and columns exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calls')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'outcome')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'status')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'status')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'door_visits')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'door_visits' AND column_name = 'outcome') THEN
    
    EXECUTE '
    CREATE OR REPLACE VIEW recent_activity AS
    SELECT 
      ''call'' as activity_type,
      id as activity_id,
      deal_id,
      started_at as activity_date,
      outcome::text as activity_status,
      NULL as activity_title
    FROM calls
    WHERE started_at >= NOW() - INTERVAL ''30 days''

    UNION ALL

    SELECT 
      ''message'' as activity_type,
      id as activity_id,
      deal_id,
      created_at as activity_date,
      status::text as activity_status,
      COALESCE(subject, '''') as activity_title
    FROM messages
    WHERE created_at >= NOW() - INTERVAL ''30 days''

    UNION ALL

    SELECT 
      ''task'' as activity_type,
      id as activity_id,
      deal_id,
      due_at as activity_date,
      status::text as activity_status,
      COALESCE(title, '''') as activity_title
    FROM tasks
    WHERE due_at >= NOW() - INTERVAL ''30 days''

    UNION ALL

    SELECT 
      ''door_visit'' as activity_type,
      id as activity_id,
      deal_id,
      visit_timestamp as activity_date,
      outcome::text as activity_status,
      NULL as activity_title
    FROM door_visits
    WHERE visit_timestamp >= NOW() - INTERVAL ''30 days''

    ORDER BY activity_date DESC;
    ';
  ELSE
    RAISE NOTICE 'Skipping recent_activity view creation - required tables/columns do not exist';
  END IF;
END $$;

-- Grant select on views (only if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'active_deals_summary') THEN
    GRANT SELECT ON active_deals_summary TO authenticated;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'quote_summary') THEN
    GRANT SELECT ON quote_summary TO authenticated;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'recent_activity') THEN
    GRANT SELECT ON recent_activity TO authenticated;
  END IF;
END $$;

COMMIT;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SEED DATA CREATED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Default deal stages seeded';
  RAISE NOTICE '🔧 Helper functions created for enums';
  RAISE NOTICE '👁️  Useful views created:';
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'active_deals_summary') THEN
    RAISE NOTICE '   • active_deals_summary';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'quote_summary') THEN
    RAISE NOTICE '   • quote_summary';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'recent_activity') THEN
    RAISE NOTICE '   • recent_activity';
  ELSE
    RAISE NOTICE '   ⚠️  recent_activity (skipped - missing required columns)';
  END IF;
  RAISE NOTICE '';
  RAISE NOTICE '📋 Next Steps:';
  RAISE NOTICE '   1. Call seed_workspace_deal_stages(UUID) for each workspace';
  RAISE NOTICE '   2. Run unit tests';
  RAISE NOTICE '   3. Review documentation';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
