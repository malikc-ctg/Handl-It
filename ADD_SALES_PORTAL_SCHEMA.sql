-- ============================================
-- Sales Portal Backend - Database Schema
-- ============================================
-- Complete schema for deals, quotes, sequences, events, and analytics
-- ============================================

-- ============================================
-- 1. CONTACTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,
  company_name TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. DEALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  site_id BIGINT REFERENCES sites(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'prospecting' CHECK (stage IN (
    'prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'
  )),
  deal_value NUMERIC(12, 2),
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  expected_close_date DATE,
  priority_score NUMERIC(10, 4),
  last_touch_at TIMESTAMPTZ,
  touch_count INTEGER DEFAULT 0,
  objection_tags TEXT[],
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. QUOTE TEMPLATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS quote_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vertical TEXT, -- e.g., 'commercial_cleaning', 'maintenance', 'landscaping'
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. QUOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  template_id UUID REFERENCES quote_templates(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  variant TEXT CHECK (variant IN ('good', 'better', 'best')),
  status TEXT NOT NULL DEFAULT 'drafted' CHECK (status IN (
    'drafted', 'sent', 'viewed', 'accepted', 'rejected', 'expired'
  )),
  total_amount NUMERIC(12, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  valid_until DATE,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ
);

-- ============================================
-- 5. QUOTE LINE ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS quote_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  total_price NUMERIC(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sequence_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. FOLLOW-UP SEQUENCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS follow_up_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_stage TEXT NOT NULL, -- stage that triggers this sequence
  enabled BOOLEAN DEFAULT true,
  stop_on_reply BOOLEAN DEFAULT true,
  stop_on_stage_change BOOLEAN DEFAULT true,
  max_attempts INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. SEQUENCE STEPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES follow_up_sequences(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('email', 'call', 'message', 'task')),
  delay_days INTEGER DEFAULT 0, -- days after previous step
  delay_hours INTEGER DEFAULT 0, -- hours after delay_days
  subject TEXT,
  body TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. SEQUENCE EXECUTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sequence_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES follow_up_sequences(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'paused', 'stopped', 'completed'
  )),
  stopped_reason TEXT,
  attempt_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  next_execution_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. DEAL EVENTS TABLE (Immutable Event Log)
-- ============================================
CREATE TABLE IF NOT EXISTS deal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'deal_created', 'deal_stage_changed', 'quote_sent', 'quote_viewed', 'quote_accepted',
    'quote_rejected', 'call_logged', 'message_sent', 'message_received', 'door_visit_logged',
    'note_added', 'contact_updated', 'deal_value_changed', 'sequence_started', 'sequence_stopped'
  )),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() -- Immutable timestamp
);

-- ============================================
-- 10. CALLS TABLE
-- ============================================
-- NOTE: Calls table is defined in ADD_QUO_CALLS_SCHEMA.sql
-- This table supports both Quo integration and sales portal use cases
-- with unified consent gating for transcripts/recordings
-- 
-- To use this table:
-- 1. Run ADD_QUO_CALLS_SCHEMA.sql first (creates the unified calls table)
-- 2. Link calls to deals using: deal_id, contact_id, user_id
-- 3. For Quo integration: use quo_call_id, quo_contact_id, site_id
-- 4. Consent required: has_consent must be true before storing transcript/recording_url

-- Indexes for sales portal queries (if table and columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calls') THEN
    -- Create index on deal_id if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'deal_id') THEN
      CREATE INDEX IF NOT EXISTS idx_calls_deal_id_sales ON calls(deal_id) WHERE deal_id IS NOT NULL;
    END IF;
    
    -- Create index on contact_id if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'contact_id') THEN
      CREATE INDEX IF NOT EXISTS idx_calls_contact_id_sales ON calls(contact_id) WHERE contact_id IS NOT NULL;
    END IF;
  END IF;
END $$;

-- ============================================
-- 11. MESSAGES TABLE (Sales context)
-- ============================================
-- Note: This extends the existing messages system for sales context
CREATE TABLE IF NOT EXISTS deal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel TEXT CHECK (channel IN ('email', 'sms', 'whatsapp', 'phone')),
  subject TEXT,
  body TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. DOOR VISITS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS door_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  visit_date TIMESTAMPTZ NOT NULL,
  outcome TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Deals indexes (check if columns exist first)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deals') THEN
    -- Check for company_id or workspace_id (different schemas use different names)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'company_id') THEN
      CREATE INDEX IF NOT EXISTS idx_deals_company_id ON deals(company_id);
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'workspace_id') THEN
      CREATE INDEX IF NOT EXISTS idx_deals_workspace_id ON deals(workspace_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'contact_id') THEN
      CREATE INDEX IF NOT EXISTS idx_deals_contact_id ON deals(contact_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'site_id') THEN
      CREATE INDEX IF NOT EXISTS idx_deals_site_id ON deals(site_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'stage') THEN
      CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'priority_score') THEN
      CREATE INDEX IF NOT EXISTS idx_deals_priority_score ON deals(priority_score DESC NULLS LAST);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'last_touch_at') THEN
      CREATE INDEX IF NOT EXISTS idx_deals_last_touch_at ON deals(last_touch_at DESC NULLS LAST);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'assigned_to') THEN
      CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON deals(assigned_to);
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'assigned_user_id') THEN
      CREATE INDEX IF NOT EXISTS idx_deals_assigned_user_id ON deals(assigned_user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'expected_close_date') THEN
      CREATE INDEX IF NOT EXISTS idx_deals_expected_close_date ON deals(expected_close_date);
    END IF;
  END IF;
END $$;

-- Quotes indexes (check if columns exist first)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quotes') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'deal_id') THEN
      CREATE INDEX IF NOT EXISTS idx_quotes_deal_id ON quotes(deal_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'status') THEN
      CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
    END IF;
    
    -- Check for version or quote_version (different schemas use different names)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'version') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'deal_id') THEN
        CREATE INDEX IF NOT EXISTS idx_quotes_version ON quotes(deal_id, version);
      END IF;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'quote_version') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'deal_id') THEN
        CREATE INDEX IF NOT EXISTS idx_quotes_quote_version ON quotes(deal_id, quote_version);
      END IF;
    END IF;
  END IF;
END $$;

-- Sequence indexes
CREATE INDEX IF NOT EXISTS idx_sequence_executions_deal_id ON sequence_executions(deal_id);
CREATE INDEX IF NOT EXISTS idx_sequence_executions_status ON sequence_executions(status);
CREATE INDEX IF NOT EXISTS idx_sequence_executions_next_execution_at ON sequence_executions(next_execution_at) WHERE status = 'active';

-- Events indexes (for timeline queries)
CREATE INDEX IF NOT EXISTS idx_deal_events_deal_id ON deal_events(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_events_created_at ON deal_events(deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_events_event_type ON deal_events(event_type);

-- Calls, messages, visits indexes
-- Calls indexes (if calls table and columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calls') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'deal_id') THEN
      CREATE INDEX IF NOT EXISTS idx_calls_deal_id ON calls(deal_id);
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'created_at') THEN
        CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(deal_id, created_at DESC);
      END IF;
    END IF;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_deal_messages_deal_id ON deal_messages(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_messages_created_at ON deal_messages(deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_door_visits_deal_id ON door_visits(deal_id);
CREATE INDEX IF NOT EXISTS idx_door_visits_created_at ON door_visits(deal_id, created_at DESC);

-- Contacts indexes (check if columns exist first)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contacts') THEN
    -- Check for company_id or workspace_id (different schemas use different names)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'company_id') THEN
      CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'workspace_id') THEN
      CREATE INDEX IF NOT EXISTS idx_contacts_workspace_id ON contacts(workspace_id);
    END IF;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- ============================================
-- FUNCTIONS FOR PRIORITY SCORING
-- ============================================

-- Function to calculate deal priority score
CREATE OR REPLACE FUNCTION calculate_deal_priority_score(deal_record deals)
RETURNS NUMERIC(10, 4)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  deal_value_weighted NUMERIC;
  close_likelihood_proxy NUMERIC;
  urgency_decay NUMERIC;
  score NUMERIC(10, 4);
  days_since_touch NUMERIC;
  stage_multiplier NUMERIC;
  touch_bonus NUMERIC;
BEGIN
  -- Deal value weighted (normalize to 0-1 range, using $100k as max for normalization)
  deal_value_weighted := LEAST(COALESCE(deal_record.deal_value, 0) / 100000.0, 1.0);
  
  -- Close likelihood proxy based on:
  -- - Stage (higher stages = higher likelihood)
  -- - Probability (0-100%)
  -- - Number of touches (more touches = more engagement)
  -- - Quote status (accepted = high likelihood)
  
  stage_multiplier := CASE deal_record.stage
    WHEN 'prospecting' THEN 0.2
    WHEN 'qualification' THEN 0.4
    WHEN 'proposal' THEN 0.6
    WHEN 'negotiation' THEN 0.8
    WHEN 'closed_won' THEN 1.0
    WHEN 'closed_lost' THEN 0.0
    ELSE 0.3
  END;
  
  touch_bonus := LEAST(COALESCE(deal_record.touch_count, 0) / 10.0, 1.0) * 0.2;
  
  close_likelihood_proxy := (stage_multiplier * 0.6) + 
                           (COALESCE(deal_record.probability, 0) / 100.0 * 0.2) + 
                           touch_bonus;
  
  -- Urgency decay based on recency of last touch
  -- Older touches = lower urgency
  IF deal_record.last_touch_at IS NULL THEN
    days_since_touch := 30; -- Treat as stale
  ELSE
    days_since_touch := EXTRACT(EPOCH FROM (NOW() - deal_record.last_touch_at)) / 86400.0;
  END IF;
  
  -- Exponential decay: urgency drops off over time
  -- After 7 days, urgency is ~0.5, after 30 days ~0.1
  urgency_decay := EXP(-days_since_touch / 10.0);
  
  -- Final score: value * likelihood * urgency
  score := deal_value_weighted * close_likelihood_proxy * urgency_decay * 100;
  
  RETURN score;
END;
$$;

-- ============================================
-- TRIGGER TO AUTO-UPDATE PRIORITY SCORE
-- ============================================

CREATE OR REPLACE FUNCTION update_deal_priority_score()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.priority_score := calculate_deal_priority_score(NEW);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_deal_priority_score
  BEFORE INSERT OR UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_priority_score();

-- ============================================
-- TRIGGER TO AUTO-CREATE EVENTS
-- ============================================

CREATE OR REPLACE FUNCTION create_deal_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  event_type_val TEXT;
  user_id_val UUID;
BEGIN
  -- Determine event type
  IF TG_OP = 'INSERT' THEN
    event_type_val := 'deal_created';
    user_id_val := NEW.assigned_to;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
      event_type_val := 'deal_stage_changed';
      user_id_val := NEW.assigned_to;
    ELSIF OLD.deal_value IS DISTINCT FROM NEW.deal_value THEN
      event_type_val := 'deal_value_changed';
      user_id_val := NEW.assigned_to;
    ELSE
      RETURN NEW; -- No significant change
    END IF;
  ELSE
    RETURN NEW;
  END IF;
  
  -- Insert event
  INSERT INTO deal_events (deal_id, event_type, user_id, old_value, new_value)
  VALUES (
    NEW.id,
    event_type_val,
    user_id_val,
    to_jsonb(OLD),
    to_jsonb(NEW)
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_deal_event
  AFTER INSERT OR UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION create_deal_event();

-- ============================================
-- FUNCTION TO CREATE NEW QUOTE VERSION
-- ============================================

CREATE OR REPLACE FUNCTION create_quote_version(
  p_deal_id UUID,
  p_base_quote_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_quote_id UUID;
  v_new_version INTEGER;
  v_version_col TEXT;
BEGIN
  -- Determine which version column name exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'version') THEN
    v_version_col := 'version';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'quote_version') THEN
    v_version_col := 'quote_version';
  ELSE
    RAISE EXCEPTION 'Quotes table does not have version or quote_version column';
  END IF;
  
  -- Get next version number using dynamic SQL
  EXECUTE format('SELECT COALESCE(MAX(%I), 0) + 1 FROM quotes WHERE deal_id = $1', v_version_col)
    USING p_deal_id
    INTO v_new_version;
  
  -- Get base quote ID if not provided
  IF p_base_quote_id IS NULL THEN
    EXECUTE format('SELECT id FROM quotes WHERE deal_id = $1 ORDER BY %I DESC LIMIT 1', v_version_col)
      USING p_deal_id
      INTO p_base_quote_id;
  END IF;
  
  -- Create new quote with version column using dynamic SQL
  EXECUTE format('
    INSERT INTO quotes (deal_id, template_id, %I, variant, status, total_amount, currency)
    SELECT 
      deal_id,
      template_id,
      $1,
      variant,
      ''drafted'',
      total_amount,
      currency
    FROM quotes
    WHERE id = $2
    LIMIT 1
    RETURNING id
  ', v_version_col)
    USING v_new_version, p_base_quote_id
    INTO v_new_quote_id;
  
  -- Copy line items if base quote exists
  IF p_base_quote_id IS NOT NULL THEN
    INSERT INTO quote_line_items (quote_id, description, quantity, unit_price, sequence_order)
    SELECT v_new_quote_id, description, quantity, unit_price, sequence_order
    FROM quote_line_items
    WHERE quote_id = p_base_quote_id;
  END IF;
  
  RETURN v_new_quote_id;
END;
$$;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Disable RLS for now (can be enabled per company_id later)
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE deals DISABLE ROW LEVEL SECURITY;
ALTER TABLE quote_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_sequences DISABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_steps DISABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_executions DISABLE ROW LEVEL SECURITY;
ALTER TABLE deal_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE calls DISABLE ROW LEVEL SECURITY;
ALTER TABLE deal_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE door_visits DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON contacts TO authenticated;
GRANT ALL ON deals TO authenticated;
GRANT ALL ON quote_templates TO authenticated;
GRANT ALL ON quotes TO authenticated;
GRANT ALL ON quote_line_items TO authenticated;
GRANT ALL ON follow_up_sequences TO authenticated;
GRANT ALL ON sequence_steps TO authenticated;
GRANT ALL ON sequence_executions TO authenticated;
GRANT ALL ON deal_events TO authenticated;
GRANT ALL ON calls TO authenticated;
GRANT ALL ON deal_messages TO authenticated;
GRANT ALL ON door_visits TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION calculate_deal_priority_score(deals) TO authenticated;
GRANT EXECUTE ON FUNCTION create_quote_version(UUID, UUID) TO authenticated;
