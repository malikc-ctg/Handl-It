-- ============================================
-- RLS POLICIES AND WORKSPACE CONSTRAINTS
-- ============================================
-- Adds Row Level Security policies and workspace_id foreign keys
-- Run this AFTER CORE_SALES_CRM_SCHEMA.sql
-- ============================================

BEGIN;

-- ============================================
-- ADD WORKSPACE FOREIGN KEY CONSTRAINTS
-- ============================================
-- Only add if company_profiles table exists

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_profiles') THEN
    -- Add foreign key constraints for workspace_id columns
    ALTER TABLE leads 
    DROP CONSTRAINT IF EXISTS fk_leads_workspace,
    ADD CONSTRAINT fk_leads_workspace 
      FOREIGN KEY (workspace_id) REFERENCES company_profiles(id) ON DELETE CASCADE;

    ALTER TABLE contacts 
    DROP CONSTRAINT IF EXISTS fk_contacts_workspace,
    ADD CONSTRAINT fk_contacts_workspace 
      FOREIGN KEY (workspace_id) REFERENCES company_profiles(id) ON DELETE CASCADE;

    ALTER TABLE deal_stages 
    DROP CONSTRAINT IF EXISTS fk_deal_stages_workspace,
    ADD CONSTRAINT fk_deal_stages_workspace 
      FOREIGN KEY (workspace_id) REFERENCES company_profiles(id) ON DELETE CASCADE;

    ALTER TABLE deals 
    DROP CONSTRAINT IF EXISTS fk_deals_workspace,
    ADD CONSTRAINT fk_deals_workspace 
      FOREIGN KEY (workspace_id) REFERENCES company_profiles(id) ON DELETE CASCADE;

    ALTER TABLE quote_templates 
    DROP CONSTRAINT IF EXISTS fk_quote_templates_workspace,
    ADD CONSTRAINT fk_quote_templates_workspace 
      FOREIGN KEY (workspace_id) REFERENCES company_profiles(id) ON DELETE CASCADE;

    ALTER TABLE calls 
    DROP CONSTRAINT IF EXISTS fk_calls_workspace,
    ADD CONSTRAINT fk_calls_workspace 
      FOREIGN KEY (workspace_id) REFERENCES company_profiles(id) ON DELETE CASCADE;

    ALTER TABLE messages 
    DROP CONSTRAINT IF EXISTS fk_messages_workspace,
    ADD CONSTRAINT fk_messages_workspace 
      FOREIGN KEY (workspace_id) REFERENCES company_profiles(id) ON DELETE CASCADE;

    ALTER TABLE tasks 
    DROP CONSTRAINT IF EXISTS fk_tasks_workspace,
    ADD CONSTRAINT fk_tasks_workspace 
      FOREIGN KEY (workspace_id) REFERENCES company_profiles(id) ON DELETE CASCADE;

    ALTER TABLE sequences 
    DROP CONSTRAINT IF EXISTS fk_sequences_workspace,
    ADD CONSTRAINT fk_sequences_workspace 
      FOREIGN KEY (workspace_id) REFERENCES company_profiles(id) ON DELETE CASCADE;

    ALTER TABLE territories 
    DROP CONSTRAINT IF EXISTS fk_territories_workspace,
    ADD CONSTRAINT fk_territories_workspace 
      FOREIGN KEY (workspace_id) REFERENCES company_profiles(id) ON DELETE CASCADE;

    ALTER TABLE routes 
    DROP CONSTRAINT IF EXISTS fk_routes_workspace,
    ADD CONSTRAINT fk_routes_workspace 
      FOREIGN KEY (workspace_id) REFERENCES company_profiles(id) ON DELETE CASCADE;

    ALTER TABLE doors 
    DROP CONSTRAINT IF EXISTS fk_doors_workspace,
    ADD CONSTRAINT fk_doors_workspace 
      FOREIGN KEY (workspace_id) REFERENCES company_profiles(id) ON DELETE CASCADE;

    RAISE NOTICE '✅ Workspace foreign key constraints added';
  ELSE
    RAISE NOTICE '⚠️  company_profiles table not found. Skipping workspace foreign keys.';
  END IF;
END $$;

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE doors ENABLE ROW LEVEL SECURITY;
ALTER TABLE door_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - LEADS
-- ============================================

-- Service role full access
CREATE POLICY "Service role full access to leads"
  ON leads FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Workspace members can view their workspace leads
CREATE POLICY "Workspace members can view leads"
  ON leads FOR SELECT
  USING (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  );

-- Workspace members can insert leads
CREATE POLICY "Workspace members can insert leads"
  ON leads FOR INSERT
  WITH CHECK (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  );

-- Workspace members can update their workspace leads
CREATE POLICY "Workspace members can update leads"
  ON leads FOR UPDATE
  USING (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  );

-- Workspace members can delete their workspace leads
CREATE POLICY "Workspace members can delete leads"
  ON leads FOR DELETE
  USING (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES - CONTACTS
-- ============================================

CREATE POLICY "Service role full access to contacts"
  ON contacts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Workspace members can view contacts"
  ON contacts FOR SELECT
  USING (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can manage contacts"
  ON contacts FOR ALL
  USING (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES - DEALS
-- ============================================

CREATE POLICY "Service role full access to deals"
  ON deals FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Workspace members can view deals"
  ON deals FOR SELECT
  USING (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
    OR assigned_user_id = auth.uid()
  );

CREATE POLICY "Workspace members can manage deals"
  ON deals FOR ALL
  USING (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES - QUOTES
-- ============================================

CREATE POLICY "Service role full access to quotes"
  ON quotes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Workspace members can view quotes for their deals
CREATE POLICY "Workspace members can view quotes"
  ON quotes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = quotes.deal_id
      AND (
        d.workspace_id IS NULL OR
        d.workspace_id IN (
          SELECT company_id FROM user_profiles WHERE id = auth.uid()
          UNION
          SELECT id FROM company_profiles WHERE owner_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Workspace members can manage quotes"
  ON quotes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = quotes.deal_id
      AND (
        d.workspace_id IS NULL OR
        d.workspace_id IN (
          SELECT company_id FROM user_profiles WHERE id = auth.uid()
          UNION
          SELECT id FROM company_profiles WHERE owner_id = auth.uid()
        )
      )
    )
  );

-- ============================================
-- RLS POLICIES - QUOTE LINE ITEMS
-- ============================================

CREATE POLICY "Service role full access to quote_line_items"
  ON quote_line_items FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Workspace members can view/manage line items for their quotes
CREATE POLICY "Workspace members can manage quote_line_items"
  ON quote_line_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      JOIN deals d ON d.id = q.deal_id
      WHERE q.id = quote_line_items.quote_id
      AND (
        d.workspace_id IS NULL OR
        d.workspace_id IN (
          SELECT company_id FROM user_profiles WHERE id = auth.uid()
          UNION
          SELECT id FROM company_profiles WHERE owner_id = auth.uid()
        )
      )
    )
  );

-- ============================================
-- RLS POLICIES - CALLS (Quo Integration)
-- ============================================

CREATE POLICY "Service role full access to calls"
  ON calls FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Workspace members can view calls"
  ON calls FOR SELECT
  USING (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert calls"
  ON calls FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Workspace members can update calls"
  ON calls FOR UPDATE
  USING (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES - MESSAGES
-- ============================================

CREATE POLICY "Service role full access to messages"
  ON messages FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Workspace members can view messages"
  ON messages FOR SELECT
  USING (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can manage messages"
  ON messages FOR ALL
  USING (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES - TASKS
-- ============================================

CREATE POLICY "Service role full access to tasks"
  ON tasks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Workspace members can view tasks"
  ON tasks FOR SELECT
  USING (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
    OR assigned_user_id = auth.uid()
  );

CREATE POLICY "Workspace members can manage tasks"
  ON tasks FOR ALL
  USING (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES - SEQUENCES
-- ============================================

CREATE POLICY "Service role full access to sequences"
  ON sequences FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Workspace members can manage sequences"
  ON sequences FOR ALL
  USING (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES - SEQUENCE STEPS
-- ============================================

CREATE POLICY "Service role full access to sequence_steps"
  ON sequence_steps FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Workspace members can manage sequence_steps"
  ON sequence_steps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sequences s
      WHERE s.id = sequence_steps.sequence_id
      AND (
        s.workspace_id IS NULL OR
        s.workspace_id IN (
          SELECT company_id FROM user_profiles WHERE id = auth.uid()
          UNION
          SELECT id FROM company_profiles WHERE owner_id = auth.uid()
        )
      )
    )
  );

-- ============================================
-- RLS POLICIES - SEQUENCE EXECUTIONS
-- ============================================

CREATE POLICY "Service role full access to sequence_executions"
  ON sequence_executions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Workspace members can view sequence_executions"
  ON sequence_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = sequence_executions.deal_id
      AND (
        d.workspace_id IS NULL OR
        d.workspace_id IN (
          SELECT company_id FROM user_profiles WHERE id = auth.uid()
          UNION
          SELECT id FROM company_profiles WHERE owner_id = auth.uid()
        )
      )
    )
  );

-- ============================================
-- RLS POLICIES - TERRITORIES
-- ============================================

CREATE POLICY "Service role full access to territories"
  ON territories FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Workspace members can manage territories"
  ON territories FOR ALL
  USING (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES - ROUTES
-- ============================================

CREATE POLICY "Service role full access to routes"
  ON routes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Workspace members can view routes"
  ON routes FOR SELECT
  USING (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
    OR assigned_user_id = auth.uid()
  );

CREATE POLICY "Workspace members can manage routes"
  ON routes FOR ALL
  USING (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES - DOORS
-- ============================================

CREATE POLICY "Service role full access to doors"
  ON doors FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Workspace members can manage doors"
  ON doors FOR ALL
  USING (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES - DOOR VISITS
-- ============================================

CREATE POLICY "Service role full access to door_visits"
  ON door_visits FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Workspace members can view door_visits"
  ON door_visits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM routes r
      WHERE r.id = door_visits.route_id
      AND (
        r.workspace_id IS NULL OR
        r.workspace_id IN (
          SELECT company_id FROM user_profiles WHERE id = auth.uid()
          UNION
          SELECT id FROM company_profiles WHERE owner_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Workspace members can insert door_visits"
  ON door_visits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM routes r
      WHERE r.id = door_visits.route_id
      AND (
        r.workspace_id IS NULL OR
        r.workspace_id IN (
          SELECT company_id FROM user_profiles WHERE id = auth.uid()
          UNION
          SELECT id FROM company_profiles WHERE owner_id = auth.uid()
        )
      )
    )
  );

-- ============================================
-- RLS POLICIES - EVENTS (Immutable)
-- ============================================

-- Events are immutable - no updates or deletes allowed
CREATE POLICY "Service role can insert events"
  ON events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can select events"
  ON events FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Workspace members can view events"
  ON events FOR SELECT
  USING (
    -- Can view events for entities they have access to
    (entity_type = 'deal' AND EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = events.entity_id
      AND (
        d.workspace_id IS NULL OR
        d.workspace_id IN (
          SELECT company_id FROM user_profiles WHERE id = auth.uid()
          UNION
          SELECT id FROM company_profiles WHERE owner_id = auth.uid()
        )
      )
    ))
    OR
    (entity_type = 'lead' AND EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = events.entity_id
      AND (
        l.workspace_id IS NULL OR
        l.workspace_id IN (
          SELECT company_id FROM user_profiles WHERE id = auth.uid()
          UNION
          SELECT id FROM company_profiles WHERE owner_id = auth.uid()
        )
      )
    ))
    OR
    (entity_type = 'contact' AND EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = events.entity_id
      AND (
        c.workspace_id IS NULL OR
        c.workspace_id IN (
          SELECT company_id FROM user_profiles WHERE id = auth.uid()
          UNION
          SELECT id FROM company_profiles WHERE owner_id = auth.uid()
        )
      )
    ))
  );

-- Prevent updates and deletes (immutable)
CREATE POLICY "No updates to events"
  ON events FOR UPDATE
  USING (false);

CREATE POLICY "No deletes to events"
  ON events FOR DELETE
  USING (false);

-- ============================================
-- RLS POLICIES - DEAL STAGES
-- ============================================

CREATE POLICY "Service role full access to deal_stages"
  ON deal_stages FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Workspace members can view deal_stages"
  ON deal_stages FOR SELECT
  USING (
    workspace_id IS NULL OR -- Default stages
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can manage custom deal_stages"
  ON deal_stages FOR ALL
  USING (
    workspace_id IS NOT NULL AND
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES - QUOTE TEMPLATES
-- ============================================

CREATE POLICY "Service role full access to quote_templates"
  ON quote_templates FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Workspace members can manage quote_templates"
  ON quote_templates FOR ALL
  USING (
    workspace_id IS NULL OR
    workspace_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM company_profiles WHERE owner_id = auth.uid()
    )
  );

COMMIT;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ RLS POLICIES AND CONSTRAINTS APPLIED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Row Level Security enabled on all tables';
  RAISE NOTICE '🔗 Workspace foreign keys configured (if company_profiles exists)';
  RAISE NOTICE '🛡️  Access policies set for workspace members';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Next Steps:';
  RAISE NOTICE '   1. Run seed data migration';
  RAISE NOTICE '   2. Run unit tests';
  RAISE NOTICE '   3. Review DATA_MODEL.md documentation';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
