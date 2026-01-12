-- ============================================
-- DEAL AUTO-CREATION & LINKING SCHEMA
-- ============================================
-- Extends deals table and creates supporting tables for
-- automatic deal creation/linking from quotes
-- ============================================

BEGIN;

-- ============================================
-- 1. EXTEND DEALS TABLE
-- ============================================
DO $$
BEGIN
  -- Add dealValue (if not exists)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'deal_value') THEN
    ALTER TABLE deals ADD COLUMN deal_value NUMERIC(12,2);
  END IF;
  
  -- Add valueType
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'value_type') THEN
    ALTER TABLE deals ADD COLUMN value_type TEXT CHECK (value_type IN ('binding', 'non_binding_range', 'unknown'));
  END IF;
  
  -- Add rangeLow, rangeHigh
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'range_low') THEN
    ALTER TABLE deals ADD COLUMN range_low NUMERIC(12,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'range_high') THEN
    ALTER TABLE deals ADD COLUMN range_high NUMERIC(12,2);
  END IF;
  
  -- Add currency (default CAD)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'currency') THEN
    ALTER TABLE deals ADD COLUMN currency TEXT DEFAULT 'CAD';
  END IF;
  
  -- Add latestQuoteId, latestQuoteRevisionNumber
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'latest_quote_id') THEN
    ALTER TABLE deals ADD COLUMN latest_quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'latest_quote_revision_number') THEN
    ALTER TABLE deals ADD COLUMN latest_quote_revision_number INTEGER;
  END IF;
  
  -- Add source
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'source') THEN
    ALTER TABLE deals ADD COLUMN source TEXT DEFAULT 'manual' CHECK (source IN ('quote_auto', 'manual'));
  END IF;
  
  -- Add isClosed, closedReason
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'is_closed') THEN
    ALTER TABLE deals ADD COLUMN is_closed BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'closed_reason') THEN
    ALTER TABLE deals ADD COLUMN closed_reason TEXT CHECK (closed_reason IN ('won', 'lost', 'abandoned', 'other'));
  END IF;
  
  -- Add lastActivityAt, nextActionAt
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'last_activity_at') THEN
    ALTER TABLE deals ADD COLUMN last_activity_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'next_action_at') THEN
    ALTER TABLE deals ADD COLUMN next_action_at TIMESTAMPTZ;
  END IF;
  
  -- Add atRisk flag
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'at_risk') THEN
    ALTER TABLE deals ADD COLUMN at_risk BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- Add accountId, primaryContactId if not exists (for compatibility with quote schema)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'account_id') THEN
    ALTER TABLE deals ADD COLUMN account_id BIGINT REFERENCES sites(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'primary_contact_id') THEN
    ALTER TABLE deals ADD COLUMN primary_contact_id UUID;
  END IF;
  
  -- Add ownerUserId (alias for assigned_user_id if needed)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'owner_user_id') THEN
    ALTER TABLE deals ADD COLUMN owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Sync owner_user_id with assigned_user_id if assigned_user_id exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'assigned_user_id') THEN
    UPDATE deals SET owner_user_id = assigned_user_id WHERE owner_user_id IS NULL AND assigned_user_id IS NOT NULL;
  END IF;
END $$;

-- ============================================
-- 2. DEAL EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS deal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'quote_revision_sent',
    'quote_viewed',
    'quote_accepted',
    'quote_declined',
    'quote_expired',
    'deal_created',
    'deal_stage_changed',
    'deal_value_updated',
    'deal_closed'
  )),
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add columns if table already exists but missing columns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_events') THEN
    -- Add timestamp column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deal_events' AND column_name = 'timestamp') THEN
      ALTER TABLE deal_events ADD COLUMN timestamp TIMESTAMPTZ DEFAULT NOW();
      -- Make it NOT NULL after setting default for existing rows
      ALTER TABLE deal_events ALTER COLUMN timestamp SET NOT NULL;
    END IF;
    
    -- Add metadata column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deal_events' AND column_name = 'metadata') THEN
      ALTER TABLE deal_events ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    -- Add created_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deal_events' AND column_name = 'created_by') THEN
      ALTER TABLE deal_events ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Indexes for deal_events (only create if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_events') THEN
    CREATE INDEX IF NOT EXISTS idx_deal_events_deal_id ON deal_events(deal_id);
    
    -- Only create timestamp index if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deal_events' AND column_name = 'timestamp') THEN
      CREATE INDEX IF NOT EXISTS idx_deal_events_timestamp ON deal_events(timestamp DESC);
    END IF;
    
    CREATE INDEX IF NOT EXISTS idx_deal_events_type ON deal_events(event_type);
  END IF;
END $$;

-- ============================================
-- 3. IDEMPOTENCY KEYS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ
);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON idempotency_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Function to clean up expired idempotency keys (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM idempotency_keys
  WHERE expires_at IS NOT NULL AND expires_at < NOW()
     OR (expires_at IS NULL AND created_at < NOW() - INTERVAL '7 days');
END;
$$;

-- ============================================
-- 4. DEAL STAGE ENUM EXTENSION
-- ============================================
-- Add new stages if deal_stage enum exists, otherwise use TEXT
DO $$
BEGIN
  -- Check if we're using TEXT or ENUM for stage
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' 
    AND column_name = 'stage' 
    AND data_type = 'USER-DEFINED'
  ) THEN
    -- Using ENUM - stages should already be defined in CORE_SALES_CRM_SCHEMA.sql
    -- We'll map to existing stages: 'prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'
    -- For new stages, we'll use stage mapping in the function
    NULL; -- No action needed, enum already exists
  ELSE
    -- Using TEXT - no constraints needed
    NULL;
  END IF;
END $$;

-- ============================================
-- 5. INDEXES FOR DEAL QUERIES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_deals_account_id_active ON deals(account_id, is_closed) 
  WHERE is_closed = FALSE;
  
CREATE INDEX IF NOT EXISTS idx_deals_account_contact_active ON deals(account_id, primary_contact_id, is_closed) 
  WHERE is_closed = FALSE AND primary_contact_id IS NOT NULL;
  
CREATE INDEX IF NOT EXISTS idx_deals_owner_stage ON deals(owner_user_id, stage) 
  WHERE owner_user_id IS NOT NULL;
  
CREATE INDEX IF NOT EXISTS idx_deals_last_activity ON deals(last_activity_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_deals_next_action ON deals(next_action_at) WHERE next_action_at IS NOT NULL;

-- ============================================
-- 6. FUNCTIONS FOR DEAL DEDUPE & LINKING
-- ============================================

-- Function: Find matching active deal
CREATE OR REPLACE FUNCTION find_matching_active_deal(
  p_account_id BIGINT,
  p_primary_contact_id UUID DEFAULT NULL,
  p_owner_user_id UUID DEFAULT NULL,
  p_dedupe_window_days INTEGER DEFAULT 30
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deal_id UUID;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := NOW() - (p_dedupe_window_days || ' days')::INTERVAL;
  
  -- Priority 1: If quote already has dealId and deal exists and is active
  -- (This will be checked in the calling function, not here)
  
  -- Priority 2: Find active deal where accountId == quote.accountId 
  -- AND primaryContactId == quote.primaryContactId AND stage not in (Won, Lost) and isClosed == false
  IF p_primary_contact_id IS NOT NULL THEN
    SELECT id INTO v_deal_id
    FROM deals
    WHERE account_id = p_account_id
      AND primary_contact_id = p_primary_contact_id
      AND is_closed = FALSE
      AND (stage NOT IN ('closed_won', 'closed_lost') OR stage IS NULL)
    ORDER BY updated_at DESC NULLS LAST, deal_value DESC NULLS LAST
    LIMIT 1;
    
    IF v_deal_id IS NOT NULL THEN
      RETURN v_deal_id;
    END IF;
  END IF;
  
  -- Priority 3: Find active deal where accountId == quote.accountId 
  -- AND isClosed == false AND createdAt within last 30 days
  SELECT id INTO v_deal_id
  FROM deals
  WHERE account_id = p_account_id
    AND is_closed = FALSE
    AND (stage NOT IN ('closed_won', 'closed_lost') OR stage IS NULL)
    AND created_at >= v_window_start
  ORDER BY updated_at DESC NULLS LAST, deal_value DESC NULLS LAST
  LIMIT 1;
  
  RETURN v_deal_id;
END;
$$;

-- Function: Check idempotency
CREATE OR REPLACE FUNCTION check_idempotency(
  p_key TEXT,
  p_expires_in_hours INTEGER DEFAULT 24
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Check if key exists
  SELECT EXISTS(SELECT 1 FROM idempotency_keys WHERE key = p_key) INTO v_exists;
  
  IF v_exists THEN
    RETURN TRUE; -- Already processed
  END IF;
  
  -- Create key with expiration
  v_expires_at := NOW() + (p_expires_in_hours || ' hours')::INTERVAL;
  
  INSERT INTO idempotency_keys (key, expires_at)
  VALUES (p_key, v_expires_at)
  ON CONFLICT (key) DO NOTHING;
  
  -- Check if insert succeeded (no conflict)
  SELECT EXISTS(SELECT 1 FROM idempotency_keys WHERE key = p_key AND created_at >= NOW() - INTERVAL '1 second') INTO v_exists;
  
  RETURN NOT v_exists; -- Return FALSE if we successfully created (not idempotent), TRUE if conflict (idempotent)
END;
$$;

-- Function: Map revision type to deal stage
CREATE OR REPLACE FUNCTION map_revision_to_stage(
  p_revision_type TEXT,
  p_quote_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_revision_type = 'walkthrough_proposal' OR p_quote_type = 'walkthrough_required' THEN
    RETURN 'prospecting'; -- Map to 'prospecting' stage (can be customized)
  ELSIF p_revision_type = 'final_quote' THEN
    RETURN 'proposal'; -- Map to 'proposal' stage
  ELSE
    RETURN 'qualification'; -- Default
  END IF;
END;
$$;

-- Function: Calculate deal value from revision
CREATE OR REPLACE FUNCTION calculate_deal_value(
  p_total NUMERIC,
  p_range_low NUMERIC,
  p_range_high NUMERIC,
  p_is_binding BOOLEAN
)
RETURNS TABLE (
  deal_value NUMERIC,
  value_type TEXT,
  range_low NUMERIC,
  range_high NUMERIC
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_is_binding AND p_total IS NOT NULL THEN
    RETURN QUERY SELECT p_total, 'binding'::TEXT, NULL::NUMERIC, NULL::NUMERIC;
  ELSIF p_range_low IS NOT NULL AND p_range_high IS NOT NULL THEN
    RETURN QUERY SELECT 
      ((p_range_low + p_range_high) / 2)::NUMERIC,
      'non_binding_range'::TEXT,
      p_range_low,
      p_range_high;
  ELSE
    RETURN QUERY SELECT NULL::NUMERIC, 'unknown'::TEXT, NULL::NUMERIC, NULL::NUMERIC;
  END IF;
END;
$$;

-- Function: Handle quote revision sent (main handler)
CREATE OR REPLACE FUNCTION on_quote_revision_sent(
  p_quote_id UUID,
  p_revision_number INTEGER,
  p_follow_up_hours INTEGER DEFAULT 24
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote RECORD;
  v_revision RECORD;
  v_deal_id UUID;
  v_idempotency_key TEXT;
  v_stage TEXT;
  v_deal_value NUMERIC;
  v_value_type TEXT;
  v_range_low NUMERIC;
  v_range_high NUMERIC;
  v_next_action_at TIMESTAMPTZ;
  v_existing_deal RECORD;
BEGIN
  -- Build idempotency key
  v_idempotency_key := 'deal_link:quoteId:' || p_quote_id::TEXT || ':rev:' || p_revision_number::TEXT || ':event:revision_sent';
  
  -- Check idempotency
  IF check_idempotency(v_idempotency_key) THEN
    -- Already processed, return existing deal
    SELECT deal_id INTO v_deal_id FROM quotes WHERE id = p_quote_id;
    RETURN v_deal_id;
  END IF;
  
  -- Fetch quote and revision
  SELECT q.*, r.* INTO v_quote, v_revision
  FROM quotes q
  JOIN quote_revisions r ON r.quote_id = q.id AND r.revision_number = p_revision_number
  WHERE q.id = p_quote_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote or revision not found';
  END IF;
  
  -- Check if quote already has dealId
  IF v_quote.deal_id IS NOT NULL THEN
    SELECT * INTO v_existing_deal FROM deals WHERE id = v_quote.deal_id AND is_closed = FALSE;
    IF FOUND THEN
      v_deal_id := v_quote.deal_id;
    END IF;
  END IF;
  
  -- Find matching deal if not already linked
  IF v_deal_id IS NULL THEN
    v_deal_id := find_matching_active_deal(
      v_quote.account_id,
      v_quote.primary_contact_id,
      v_quote.owner_user_id,
      30 -- dedupe window days
    );
  END IF;
  
  -- Calculate deal value
  SELECT * INTO v_deal_value, v_value_type, v_range_low, v_range_high
  FROM calculate_deal_value(
    v_revision.total,
    (SELECT MIN(range_low) FROM quote_line_items WHERE quote_id = p_quote_id AND revision_number = p_revision_number AND range_low IS NOT NULL),
    (SELECT MAX(range_high) FROM quote_line_items WHERE quote_id = p_quote_id AND revision_number = p_revision_number AND range_high IS NOT NULL),
    v_revision.is_binding
  );
  
  -- Map stage
  v_stage := map_revision_to_stage(v_revision.revision_type, v_quote.quote_type);
  
  -- Calculate next action time
  v_next_action_at := NOW() + (p_follow_up_hours || ' hours')::INTERVAL;
  
  -- Create or update deal
  IF v_deal_id IS NULL THEN
    -- Create new deal
    INSERT INTO deals (
      account_id,
      primary_contact_id,
      owner_user_id,
      stage,
      deal_value,
      value_type,
      range_low,
      range_high,
      currency,
      latest_quote_id,
      latest_quote_revision_number,
      source,
      is_closed,
      last_activity_at,
      next_action_at,
      created_at,
      updated_at
    ) VALUES (
      v_quote.account_id,
      v_quote.primary_contact_id,
      v_quote.owner_user_id,
      v_stage,
      v_deal_value,
      v_value_type,
      v_range_low,
      v_range_high,
      COALESCE(v_quote.currency, 'CAD'),
      p_quote_id,
      p_revision_number,
      'quote_auto',
      FALSE,
      NOW(),
      v_next_action_at,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_deal_id;
    
    -- Create deal event
    INSERT INTO deal_events (deal_id, event_type, metadata)
    VALUES (
      v_deal_id,
      'deal_created',
      jsonb_build_object(
        'quote_id', p_quote_id,
        'revision_number', p_revision_number,
        'source', 'quote_auto'
      )
    );
  ELSE
    -- Update existing deal
    SELECT * INTO v_existing_deal FROM deals WHERE id = v_deal_id;
    
    -- Don't regress Won/Lost stages
    IF v_existing_deal.stage NOT IN ('closed_won', 'closed_lost') THEN
      UPDATE deals
      SET stage = v_stage,
          latest_quote_id = p_quote_id,
          latest_quote_revision_number = p_revision_number,
          last_activity_at = NOW(),
          next_action_at = CASE 
            WHEN next_action_at IS NULL OR next_action_at < NOW() THEN v_next_action_at
            ELSE next_action_at
          END,
          updated_at = NOW()
      WHERE id = v_deal_id;
    ELSE
      -- Just update activity, don't change stage
      UPDATE deals
      SET latest_quote_id = p_quote_id,
          latest_quote_revision_number = p_revision_number,
          last_activity_at = NOW(),
          updated_at = NOW()
      WHERE id = v_deal_id;
    END IF;
    
    -- Update deal value (binding beats non-binding)
    IF v_value_type = 'binding' OR (v_existing_deal.value_type IS NULL OR v_existing_deal.value_type != 'binding') THEN
      UPDATE deals
      SET deal_value = v_deal_value,
          value_type = v_value_type,
          range_low = v_range_low,
          range_high = v_range_high,
          updated_at = NOW()
      WHERE id = v_deal_id;
    END IF;
  END IF;
  
  -- Link quote to deal
  UPDATE quotes
  SET deal_id = v_deal_id,
      updated_at = NOW()
  WHERE id = p_quote_id;
  
  -- Create deal event
  INSERT INTO deal_events (deal_id, event_type, metadata)
  VALUES (
    v_deal_id,
    'quote_revision_sent',
    jsonb_build_object(
      'quote_id', p_quote_id,
      'revision_number', p_revision_number,
      'revision_type', v_revision.revision_type,
      'total', v_revision.total,
      'range_low', v_range_low,
      'range_high', v_range_high,
      'is_binding', v_revision.is_binding
    )
  );
  
  RETURN v_deal_id;
END;
$$;

-- Function: Handle quote accepted
CREATE OR REPLACE FUNCTION on_quote_accepted(
  p_quote_id UUID,
  p_revision_number INTEGER,
  p_signer_name TEXT DEFAULT NULL,
  p_signer_email TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote RECORD;
  v_revision RECORD;
  v_deal_id UUID;
  v_idempotency_key TEXT;
BEGIN
  v_idempotency_key := 'deal_link:quoteId:' || p_quote_id::TEXT || ':rev:' || p_revision_number::TEXT || ':event:accepted';
  
  IF check_idempotency(v_idempotency_key) THEN
    SELECT deal_id INTO v_deal_id FROM quotes WHERE id = p_quote_id;
    RETURN v_deal_id;
  END IF;
  
  SELECT q.*, r.* INTO v_quote, v_revision
  FROM quotes q
  JOIN quote_revisions r ON r.quote_id = q.id AND r.revision_number = p_revision_number
  WHERE q.id = p_quote_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote or revision not found';
  END IF;
  
  v_deal_id := v_quote.deal_id;
  
  IF v_deal_id IS NULL THEN
    -- Try to find or create deal
    v_deal_id := on_quote_revision_sent(p_quote_id, p_revision_number);
  END IF;
  
  -- Update deal to Won
  UPDATE deals
  SET stage = 'closed_won',
      is_closed = TRUE,
      closed_reason = 'won',
      deal_value = COALESCE(v_revision.total, deal_value),
      value_type = CASE WHEN v_revision.is_binding THEN 'binding' ELSE value_type END,
      last_activity_at = NOW(),
      updated_at = NOW()
  WHERE id = v_deal_id;
  
  -- Create deal event
  INSERT INTO deal_events (deal_id, event_type, metadata)
  VALUES (
    v_deal_id,
    'quote_accepted',
    jsonb_build_object(
      'quote_id', p_quote_id,
      'revision_number', p_revision_number,
      'signer_name', p_signer_name,
      'signer_email', p_signer_email
    )
  );
  
  RETURN v_deal_id;
END;
$$;

-- Function: Handle quote declined
CREATE OR REPLACE FUNCTION on_quote_declined(
  p_quote_id UUID,
  p_revision_number INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote RECORD;
  v_deal_id UUID;
  v_idempotency_key TEXT;
BEGIN
  v_idempotency_key := 'deal_link:quoteId:' || p_quote_id::TEXT || ':rev:' || p_revision_number::TEXT || ':event:declined';
  
  IF check_idempotency(v_idempotency_key) THEN
    SELECT deal_id INTO v_deal_id FROM quotes WHERE id = p_quote_id;
    RETURN v_deal_id;
  END IF;
  
  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;
  
  v_deal_id := v_quote.deal_id;
  
  IF v_deal_id IS NULL THEN
    RETURN NULL; -- No deal to update
  END IF;
  
  -- Update deal to Lost
  UPDATE deals
  SET stage = 'closed_lost',
      is_closed = TRUE,
      closed_reason = 'lost',
      last_activity_at = NOW(),
      updated_at = NOW()
  WHERE id = v_deal_id;
  
  -- Create deal event
  INSERT INTO deal_events (deal_id, event_type, metadata)
  VALUES (
    v_deal_id,
    'quote_declined',
    jsonb_build_object(
      'quote_id', p_quote_id,
      'revision_number', p_revision_number,
      'reason', p_reason
    )
  );
  
  RETURN v_deal_id;
END;
$$;

-- Function: Handle quote expired
CREATE OR REPLACE FUNCTION on_quote_expired(
  p_quote_id UUID,
  p_revision_number INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote RECORD;
  v_deal_id UUID;
  v_idempotency_key TEXT;
BEGIN
  v_idempotency_key := 'deal_link:quoteId:' || p_quote_id::TEXT || ':rev:' || p_revision_number::TEXT || ':event:expired';
  
  IF check_idempotency(v_idempotency_key) THEN
    SELECT deal_id INTO v_deal_id FROM quotes WHERE id = p_quote_id;
    RETURN v_deal_id;
  END IF;
  
  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;
  
  v_deal_id := v_quote.deal_id;
  
  IF v_deal_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Mark deal as at risk and set next action
  UPDATE deals
  SET at_risk = TRUE,
      next_action_at = NOW(),
      last_activity_at = NOW(),
      updated_at = NOW()
  WHERE id = v_deal_id AND is_closed = FALSE;
  
  -- Create deal event
  INSERT INTO deal_events (deal_id, event_type, metadata)
  VALUES (
    v_deal_id,
    'quote_expired',
    jsonb_build_object(
      'quote_id', p_quote_id,
      'revision_number', p_revision_number
    )
  );
  
  RETURN v_deal_id;
END;
$$;

-- Function: Handle quote viewed
CREATE OR REPLACE FUNCTION on_quote_viewed(
  p_quote_id UUID,
  p_revision_number INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote RECORD;
  v_deal_id UUID;
  v_idempotency_key TEXT;
BEGIN
  v_idempotency_key := 'deal_link:quoteId:' || p_quote_id::TEXT || ':rev:' || p_revision_number::TEXT || ':event:viewed';
  
  IF check_idempotency(v_idempotency_key, 1) THEN -- 1 hour idempotency for views
    SELECT deal_id INTO v_deal_id FROM quotes WHERE id = p_quote_id;
    RETURN v_deal_id;
  END IF;
  
  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;
  
  v_deal_id := v_quote.deal_id;
  
  IF v_deal_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Update last activity
  UPDATE deals
  SET last_activity_at = NOW(),
      updated_at = NOW()
  WHERE id = v_deal_id;
  
  -- Create deal event
  INSERT INTO deal_events (deal_id, event_type, metadata)
  VALUES (
    v_deal_id,
    'quote_viewed',
    jsonb_build_object(
      'quote_id', p_quote_id,
      'revision_number', p_revision_number
    )
  );
  
  RETURN v_deal_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION find_matching_active_deal TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_idempotency TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION on_quote_revision_sent TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION on_quote_accepted TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION on_quote_declined TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION on_quote_expired TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION on_quote_viewed TO authenticated, service_role;

-- RLS Policies
ALTER TABLE deal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON deal_events FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for service role" ON idempotency_keys FOR ALL USING (auth.role() = 'service_role');

COMMIT;

SELECT '✅ Deal auto-creation and linking schema created successfully!' as result;
