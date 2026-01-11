-- ============================================
-- RBAC and Audit Logging System
-- ============================================
-- Comprehensive role-based access control and audit logging
-- for Sales Portal, Calls, Messages, and Routes
-- ============================================

-- ============================================
-- STEP 1: AUDIT LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(100) NOT NULL, -- e.g., 'deal.stage_change', 'quote.send', 'call.recording_access'
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  target_type VARCHAR(50), -- 'deal', 'quote', 'call', 'message', 'route'
  target_id UUID, -- ID of the resource being acted upon
  before_state JSONB, -- State before the action
  after_state JSONB, -- State after the action
  ip_address INET,
  user_agent TEXT,
  metadata JSONB, -- Additional context
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_type ON audit_logs(target_type);

-- Enable RLS on audit logs (only admins can view)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Service role can insert audit logs (for triggers and functions)
-- Note: RLS is bypassed for service role, but explicit is better
GRANT SELECT ON audit_logs TO authenticated;
GRANT INSERT ON audit_logs TO authenticated, service_role;

-- ============================================
-- STEP 2: SALES PORTAL SCHEMA
-- ============================================

-- Deals Table (may already exist from CORE_SALES_CRM_SCHEMA.sql)
-- Skip table creation, just ensure we have the columns we need
DO $$
BEGIN
  -- Add assigned_to column if it doesn't exist (for compatibility with RBAC functions)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deals') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'assigned_to') THEN
      -- If assigned_user_id exists, copy its value to assigned_to, or add as new column
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'assigned_user_id') THEN
        ALTER TABLE deals ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        -- Copy data from assigned_user_id to assigned_to
        UPDATE deals SET assigned_to = assigned_user_id WHERE assigned_user_id IS NOT NULL;
      ELSE
        ALTER TABLE deals ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
      END IF;
    END IF;
    
    -- Add created_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'created_by') THEN
      ALTER TABLE deals ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Quotes Table (may already exist from CORE_SALES_CRM_SCHEMA.sql)
-- Skip table creation, just ensure we have the columns we need
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quotes') THEN
    -- Add created_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'created_by') THEN
      ALTER TABLE quotes ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    
    -- Add approved_by column if it doesn't exist (for compatibility with RBAC functions)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'approved_by') THEN
      ALTER TABLE quotes ADD COLUMN approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Indexes for deals and quotes (check if columns exist first)
DO $$
BEGIN
  -- Check for assigned_to or assigned_user_id (different schemas use different names)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'assigned_to') THEN
    CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON deals(assigned_to);
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'assigned_user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_deals_assigned_user_id ON deals(assigned_user_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'created_by') THEN
    CREATE INDEX IF NOT EXISTS idx_deals_created_by ON deals(created_by);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'stage') THEN
    CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'site_id') THEN
    CREATE INDEX IF NOT EXISTS idx_deals_site_id ON deals(site_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_quotes_deal_id ON quotes(deal_id);
-- Index for quotes created_by (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'created_by') THEN
    CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON quotes(created_by);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'approved_by') THEN
    CREATE INDEX IF NOT EXISTS idx_quotes_approved_by ON quotes(approved_by);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);

-- Enable RLS
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: CALLS SCHEMA
-- ============================================

-- Calls Table (may already exist from CORE_SALES_CRM_SCHEMA.sql)
-- Skip table creation, just ensure we have the columns we need
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calls') THEN
    -- Add caller_id column if it doesn't exist (for compatibility with RBAC functions)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'caller_id') THEN
      ALTER TABLE calls ADD COLUMN caller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    
    -- Add call_date column if it doesn't exist (alias for started_at or created_at)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'call_date') THEN
      -- Check if started_at exists, use it; otherwise use created_at
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'started_at') THEN
        ALTER TABLE calls ADD COLUMN call_date TIMESTAMPTZ;
        UPDATE calls SET call_date = started_at WHERE call_date IS NULL;
      ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'created_at') THEN
        ALTER TABLE calls ADD COLUMN call_date TIMESTAMPTZ;
        UPDATE calls SET call_date = created_at WHERE call_date IS NULL;
      ELSE
        ALTER TABLE calls ADD COLUMN call_date TIMESTAMPTZ DEFAULT NOW();
      END IF;
    END IF;
    
    -- Add recording_consent if it doesn't exist (check for call_recording_consent first)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'recording_consent') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'call_recording_consent') THEN
        ALTER TABLE calls ADD COLUMN recording_consent BOOLEAN;
        UPDATE calls SET recording_consent = call_recording_consent WHERE recording_consent IS NULL;
      ELSE
        ALTER TABLE calls ADD COLUMN recording_consent BOOLEAN DEFAULT FALSE;
      END IF;
    END IF;
    
    -- Add transcript_consent if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'transcript_consent') THEN
      -- Check if transcript_text exists, assume consent if it does
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'transcript_text') THEN
        ALTER TABLE calls ADD COLUMN transcript_consent BOOLEAN;
        UPDATE calls SET transcript_consent = (transcript_text IS NOT NULL) WHERE transcript_consent IS NULL;
      ELSE
        ALTER TABLE calls ADD COLUMN transcript_consent BOOLEAN DEFAULT FALSE;
      END IF;
    END IF;
  END IF;
END $$;

-- Call Recordings Table
CREATE TABLE IF NOT EXISTS call_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE NOT NULL,
  recording_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  duration INTEGER, -- in seconds
  file_size BIGINT, -- in bytes
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  consent_verified BOOLEAN DEFAULT FALSE NOT NULL
);

-- Call Transcripts Table
CREATE TABLE IF NOT EXISTS call_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE NOT NULL UNIQUE,
  transcript_text TEXT NOT NULL,
  transcript_url TEXT, -- If stored as file
  language TEXT DEFAULT 'en',
  confidence_score NUMERIC(3, 2), -- 0.00 to 1.00
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  consent_verified BOOLEAN DEFAULT FALSE NOT NULL
);

-- Indexes for calls (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'deal_id') THEN
    CREATE INDEX IF NOT EXISTS idx_calls_deal_id ON calls(deal_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'caller_id') THEN
    CREATE INDEX IF NOT EXISTS idx_calls_caller_id ON calls(caller_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'call_date') THEN
    CREATE INDEX IF NOT EXISTS idx_calls_call_date ON calls(call_date DESC);
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'started_at') THEN
    CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at DESC);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_call_recordings_call_id ON call_recordings(call_id);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_call_id ON call_transcripts(call_id);

-- Enable RLS
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: ROUTES SCHEMA
-- ============================================

-- Routes Table (may already exist from CORE_SALES_CRM_SCHEMA.sql)
-- Skip table creation, just ensure we have the columns we need
DO $$
BEGIN
  -- Add assigned_to column if it doesn't exist (for compatibility with RBAC functions)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'routes') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'assigned_to') THEN
      -- If assigned_user_id exists, copy its value to assigned_to, or add as new column
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'assigned_user_id') THEN
        ALTER TABLE routes ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        -- Copy data from assigned_user_id to assigned_to
        UPDATE routes SET assigned_to = assigned_user_id WHERE assigned_user_id IS NOT NULL;
      ELSE
        ALTER TABLE routes ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL;
      END IF;
    END IF;
  END IF;
END $$;

-- Route Locations Table (tracks location only during active routes)
CREATE TABLE IF NOT EXISTS route_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  latitude NUMERIC(10, 8) NOT NULL,
  longitude NUMERIC(11, 8) NOT NULL,
  accuracy NUMERIC(8, 2), -- in meters
  altitude NUMERIC(8, 2),
  heading NUMERIC(5, 2), -- in degrees
  speed NUMERIC(8, 2), -- in m/s
  recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for routes
-- Index for routes assigned_to (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'assigned_to') THEN
    CREATE INDEX IF NOT EXISTS idx_routes_assigned_to ON routes(assigned_to);
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'assigned_user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_routes_assigned_user_id ON routes(assigned_user_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_route_locations_route_id ON route_locations(route_id);
CREATE INDEX IF NOT EXISTS idx_route_locations_user_id ON route_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_route_locations_recorded_at ON route_locations(recorded_at DESC);

-- Enable RLS
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_locations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 5: RBAC HELPER FUNCTIONS
-- ============================================

-- Get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id_param UUID)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = user_id_param;
  
  RETURN COALESCE(user_role, 'worker');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is team member (for manager team access)
-- This assumes a team relationship table exists, or uses site assignments
-- For now, we'll check if user has same organization or is assigned to same sites
CREATE OR REPLACE FUNCTION is_team_member(manager_id UUID, member_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- If checking self, return true
  IF manager_id = member_id THEN
    RETURN TRUE;
  END IF;
  
  -- If manager is actually admin, they can see all
  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = manager_id AND role = 'admin') THEN
    RETURN TRUE;
  END IF;
  
  -- For now, managers can see users assigned to same sites
  -- This can be extended with a proper teams/team_members table
  RETURN EXISTS (
    SELECT 1
    FROM worker_site_assignments wsa1
    INNER JOIN worker_site_assignments wsa2 ON wsa1.site_id = wsa2.site_id
    WHERE wsa1.worker_id = manager_id
      AND wsa2.worker_id = member_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- [DEBUG] Starting can_access_deal function creation
-- Check if user can access deal based on assignment and role
CREATE OR REPLACE FUNCTION can_access_deal(user_id_param UUID, deal_id_param UUID, action_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  assigned_user_uuid UUID;
  created_by_uuid UUID;
  deal_exists BOOLEAN;
BEGIN
  -- Instrumentation: Hypothesis A - Function entry
  RAISE NOTICE '[DEBUG-HYP-A] can_access_deal called with deal_id: %', deal_id_param;
  
  -- Get user role first
  BEGIN
    user_role := get_user_role(user_id_param);
    RAISE NOTICE '[DEBUG-HYP-A] Got user_role: %', user_role;
  EXCEPTION WHEN OTHERS THEN
    user_role := 'worker';
    RAISE NOTICE '[DEBUG-HYP-A] Exception getting role, defaulted to worker';
  END;
  
  -- Check if deal exists
  BEGIN
    RAISE NOTICE '[DEBUG-HYP-B] Checking if deal exists';
    EXECUTE 'SELECT EXISTS(SELECT 1 FROM deals WHERE id = $1)' USING deal_id_param INTO deal_exists;
    RAISE NOTICE '[DEBUG-HYP-B] Deal exists: %', deal_exists;
    IF NOT deal_exists THEN
      RETURN FALSE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[DEBUG-HYP-B] Exception checking deal existence: %', SQLERRM;
    RETURN FALSE;
  END;
  
  -- Try to get assigned user - try all possible column combinations
  BEGIN
    RAISE NOTICE '[DEBUG-HYP-C] Trying to get assigned_user with COALESCE';
    -- Try COALESCE first (both columns)
    EXECUTE 'SELECT COALESCE(assigned_to, assigned_user_id) FROM deals WHERE id = $1' 
      USING deal_id_param INTO assigned_user_uuid;
    RAISE NOTICE '[DEBUG-HYP-C] Got assigned_user via COALESCE: %', assigned_user_uuid;
  EXCEPTION 
    WHEN undefined_column THEN
      RAISE NOTICE '[DEBUG-HYP-C] undefined_column exception, trying assigned_to only';
      -- Try assigned_to alone
      BEGIN
        EXECUTE 'SELECT assigned_to FROM deals WHERE id = $1' 
          USING deal_id_param INTO assigned_user_uuid;
        RAISE NOTICE '[DEBUG-HYP-C] Got assigned_user via assigned_to: %', assigned_user_uuid;
      EXCEPTION 
        WHEN undefined_column THEN
          RAISE NOTICE '[DEBUG-HYP-C] undefined_column exception, trying assigned_user_id only';
          -- Try assigned_user_id alone
          BEGIN
            EXECUTE 'SELECT assigned_user_id FROM deals WHERE id = $1' 
              USING deal_id_param INTO assigned_user_uuid;
            RAISE NOTICE '[DEBUG-HYP-C] Got assigned_user via assigned_user_id: %', assigned_user_uuid;
          EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[DEBUG-HYP-C] Exception getting assigned_user: %', SQLERRM;
            assigned_user_uuid := NULL;
          END;
        WHEN OTHERS THEN
          RAISE NOTICE '[DEBUG-HYP-C] Exception in assigned_to block: %', SQLERRM;
          assigned_user_uuid := NULL;
      END;
    WHEN OTHERS THEN
      RAISE NOTICE '[DEBUG-HYP-C] Exception in assigned_user section: %', SQLERRM;
      assigned_user_uuid := NULL;
  END;
  
  -- Try to get created_by value
  BEGIN
    RAISE NOTICE '[DEBUG-HYP-D] Trying to get created_by';
    EXECUTE 'SELECT created_by FROM deals WHERE id = $1' 
      USING deal_id_param 
      INTO created_by_uuid;
    RAISE NOTICE '[DEBUG-HYP-D] Got created_by: %', created_by_uuid;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[DEBUG-HYP-D] Exception getting created_by: %', SQLERRM;
    created_by_uuid := NULL;
  END;
  
  -- Admins can do everything
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Managers can read/write deals assigned to their team
  IF user_role = 'manager' THEN
    IF action_type IN ('read', 'write') THEN
      -- Can access if assigned to them or a team member
      RETURN assigned_user_uuid = user_id_param 
         OR created_by_uuid = user_id_param
         OR (assigned_user_uuid IS NOT NULL AND is_team_member(user_id_param, assigned_user_uuid));
    END IF;
  END IF;
  
  -- Workers/Reps can read/write deals assigned to them
  IF user_role IN ('worker', 'rep') THEN
    IF action_type IN ('read', 'write') THEN
      RETURN assigned_user_uuid = user_id_param 
         OR created_by_uuid = user_id_param;
    END IF;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_team_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_access_deal(UUID, UUID, TEXT) TO authenticated;

-- ============================================
-- STEP 6: AUDIT LOGGING FUNCTIONS
-- ============================================

-- Emit audit log entry
CREATE OR REPLACE FUNCTION emit_audit_log(
  action_param TEXT,
  actor_id_param UUID,
  target_type_param TEXT DEFAULT NULL,
  target_id_param UUID DEFAULT NULL,
  before_state_param JSONB DEFAULT NULL,
  after_state_param JSONB DEFAULT NULL,
  metadata_param JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  audit_id UUID;
BEGIN
  INSERT INTO audit_logs (
    action,
    actor_id,
    target_type,
    target_id,
    before_state,
    after_state,
    metadata,
    created_at
  )
  VALUES (
    action_param,
    actor_id_param,
    target_type_param,
    target_id_param,
    before_state_param,
    after_state_param,
    metadata_param,
    NOW()
  )
  RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION emit_audit_log(TEXT, UUID, TEXT, UUID, JSONB, JSONB, JSONB) TO authenticated;

-- ============================================
-- STEP 7: DEALS RLS POLICIES
-- ============================================

-- Reps can view deals assigned to them or they created
DROP POLICY IF EXISTS "Reps can view assigned deals" ON deals;
CREATE POLICY "Reps can view assigned deals"
  ON deals FOR SELECT
  USING (
    COALESCE(assigned_to, assigned_user_id) = auth.uid() 
    OR (created_by IS NOT NULL AND created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
    OR (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND role = 'manager'
      )
      AND COALESCE(assigned_to, assigned_user_id) IS NOT NULL
      AND is_team_member(auth.uid(), COALESCE(assigned_to, assigned_user_id))
    )
  );

-- Reps can create deals
DROP POLICY IF EXISTS "Reps can create deals" ON deals;
CREATE POLICY "Reps can create deals"
  ON deals FOR INSERT
  WITH CHECK (
    (created_by IS NULL OR created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Reps can update deals assigned to them (admins/managers can update any)
DROP POLICY IF EXISTS "Users can update deals by assignment" ON deals;
CREATE POLICY "Users can update deals by assignment"
  ON deals FOR UPDATE
  USING (
    can_access_deal(auth.uid(), id, 'write')
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- ============================================
-- STEP 8: QUOTES RLS POLICIES
-- ============================================

-- Reps can view quotes they created; managers see team quotes; admins see all
DROP POLICY IF EXISTS "Users can view quotes by role" ON quotes;
CREATE POLICY "Users can view quotes by role"
  ON quotes FOR SELECT
  USING (
    (created_by IS NOT NULL AND created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
    OR (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND role = 'manager'
      )
      AND EXISTS (
        SELECT 1 FROM deals d
        WHERE d.id = quotes.deal_id
        AND (COALESCE(d.assigned_to, d.assigned_user_id) = auth.uid() 
          OR (COALESCE(d.assigned_to, d.assigned_user_id) IS NOT NULL 
              AND is_team_member(auth.uid(), COALESCE(d.assigned_to, d.assigned_user_id))))
      )
    )
    OR (
      EXISTS (
        SELECT 1 FROM deals d
        WHERE d.id = quotes.deal_id
        AND (COALESCE(d.assigned_to, d.assigned_user_id) = auth.uid() OR (d.created_by IS NOT NULL AND d.created_by = auth.uid()))
      )
    )
  );

-- Reps can create quotes
DROP POLICY IF EXISTS "Reps can create quotes" ON quotes;
CREATE POLICY "Reps can create quotes"
  ON quotes FOR INSERT
  WITH CHECK (
    (created_by IS NULL OR created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Reps can update their own quotes; managers can approve; admins can override
DROP POLICY IF EXISTS "Users can update quotes by role" ON quotes;
CREATE POLICY "Users can update quotes by role"
  ON quotes FOR UPDATE
  USING (
    (created_by IS NOT NULL AND created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
    OR (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND role = 'manager'
      )
      AND quotes.status IN ('accepted', 'rejected') -- Managers can approve/reject
    )
  )
  WITH CHECK (
    (created_by IS NULL OR created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
    OR (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND role = 'manager'
      )
      AND status IN ('accepted', 'rejected') -- Managers can approve/reject (check NEW values)
    )
  );

-- ============================================
-- STEP 9: CALLS RLS POLICIES
-- ============================================

-- Reps see their own calls and assigned deal calls; managers see team; admin sees all
DROP POLICY IF EXISTS "Users can view calls by role" ON calls;
CREATE POLICY "Users can view calls by role"
  ON calls FOR SELECT
  USING (
    (caller_id IS NOT NULL AND caller_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
    OR (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND role = 'manager'
      )
      AND EXISTS (
        SELECT 1 FROM deals d
        WHERE d.id = calls.deal_id
        AND (COALESCE(d.assigned_to, d.assigned_user_id) = auth.uid() 
          OR (COALESCE(d.assigned_to, d.assigned_user_id) IS NOT NULL 
              AND is_team_member(auth.uid(), COALESCE(d.assigned_to, d.assigned_user_id))))
      )
    )
    OR (
      deal_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM deals d
        WHERE d.id = calls.deal_id
        AND (COALESCE(d.assigned_to, d.assigned_user_id) = auth.uid() OR (d.created_by IS NOT NULL AND d.created_by = auth.uid()))
      )
    )
  );

-- Reps can create calls
DROP POLICY IF EXISTS "Reps can create calls" ON calls;
CREATE POLICY "Reps can create calls"
  ON calls FOR INSERT
  WITH CHECK (
    (caller_id IS NULL OR caller_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Reps can update their own calls
DROP POLICY IF EXISTS "Users can update their calls" ON calls;
CREATE POLICY "Users can update their calls"
  ON calls FOR UPDATE
  USING (
    (caller_id IS NOT NULL AND caller_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- ============================================
-- STEP 10: CALL RECORDINGS RLS POLICIES
-- ============================================

-- Same access rules as calls, but only if consent is enabled
DROP POLICY IF EXISTS "Users can view recordings with consent" ON call_recordings;
CREATE POLICY "Users can view recordings with consent"
  ON call_recordings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM calls c
      WHERE c.id = call_recordings.call_id
      AND COALESCE(c.recording_consent, c.call_recording_consent, FALSE) = TRUE
      AND (
        (c.caller_id IS NOT NULL AND c.caller_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() 
          AND role = 'admin'
        )
        OR (
          EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'manager'
          )
          AND EXISTS (
            SELECT 1 FROM deals d
            WHERE d.id = c.deal_id
            AND (COALESCE(d.assigned_to, d.assigned_user_id) = auth.uid() 
              OR (COALESCE(d.assigned_to, d.assigned_user_id) IS NOT NULL 
                  AND is_team_member(auth.uid(), COALESCE(d.assigned_to, d.assigned_user_id))))
          )
        )
        OR (
          c.deal_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM deals d
            WHERE d.id = c.deal_id
            AND (COALESCE(d.assigned_to, d.assigned_user_id) = auth.uid() OR (d.created_by IS NOT NULL AND d.created_by = auth.uid()))
          )
        )
      )
    )
  );

-- Only allow inserting recordings if consent is enabled
DROP POLICY IF EXISTS "Users can create recordings with consent" ON call_recordings;
CREATE POLICY "Users can create recordings with consent"
  ON call_recordings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calls c
      WHERE c.id = call_recordings.call_id
      AND COALESCE(c.recording_consent, c.call_recording_consent, FALSE) = TRUE
    )
    AND (
      EXISTS (
        SELECT 1 FROM calls c
        WHERE c.id = call_recordings.call_id
        AND c.caller_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() 
        AND role IN ('admin', 'manager')
      )
    )
  );

-- ============================================
-- STEP 11: CALL TRANSCRIPTS RLS POLICIES
-- ============================================

-- Same as recordings but for transcripts
DROP POLICY IF EXISTS "Users can view transcripts with consent" ON call_transcripts;
CREATE POLICY "Users can view transcripts with consent"
  ON call_transcripts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM calls c
      WHERE c.id = call_transcripts.call_id
      AND COALESCE(c.transcript_consent, CASE WHEN c.transcript_text IS NOT NULL THEN TRUE ELSE FALSE END, FALSE) = TRUE
      AND (
        (c.caller_id IS NOT NULL AND c.caller_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() 
          AND role = 'admin'
        )
        OR (
          EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'manager'
          )
          AND EXISTS (
            SELECT 1 FROM deals d
            WHERE d.id = c.deal_id
            AND (COALESCE(d.assigned_to, d.assigned_user_id) = auth.uid() 
              OR (COALESCE(d.assigned_to, d.assigned_user_id) IS NOT NULL 
                  AND is_team_member(auth.uid(), COALESCE(d.assigned_to, d.assigned_user_id))))
          )
        )
        OR (
          c.deal_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM deals d
            WHERE d.id = c.deal_id
            AND (COALESCE(d.assigned_to, d.assigned_user_id) = auth.uid() OR (d.created_by IS NOT NULL AND d.created_by = auth.uid()))
          )
        )
      )
    )
  );

-- Only allow inserting transcripts if consent is enabled
DROP POLICY IF EXISTS "Users can create transcripts with consent" ON call_transcripts;
CREATE POLICY "Users can create transcripts with consent"
  ON call_transcripts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calls c
      WHERE c.id = call_transcripts.call_id
      AND COALESCE(c.transcript_consent, CASE WHEN c.transcript_text IS NOT NULL THEN TRUE ELSE FALSE END, FALSE) = TRUE
    )
    AND (
      EXISTS (
        SELECT 1 FROM calls c
        WHERE c.id = call_transcripts.call_id
        AND c.caller_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() 
        AND role IN ('admin', 'manager')
      )
    )
  );

-- ============================================
-- STEP 12: ROUTES RLS POLICIES
-- ============================================

-- Reps access own route; managers view team routes; admin all
DROP POLICY IF EXISTS "Users can view routes by role" ON routes;
CREATE POLICY "Users can view routes by role"
  ON routes FOR SELECT
  USING (
    COALESCE(assigned_to, assigned_user_id) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
    OR (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND role = 'manager'
      )
      AND COALESCE(assigned_to, assigned_user_id) IS NOT NULL
      AND is_team_member(auth.uid(), COALESCE(assigned_to, assigned_user_id))
    )
  );

-- Reps can create routes for themselves
DROP POLICY IF EXISTS "Reps can create routes" ON routes;
CREATE POLICY "Reps can create routes"
  ON routes FOR INSERT
  WITH CHECK (
    COALESCE(assigned_to, assigned_user_id) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Reps can update their own routes
DROP POLICY IF EXISTS "Users can update their routes" ON routes;
CREATE POLICY "Users can update their routes"
  ON routes FOR UPDATE
  USING (
    COALESCE(assigned_to, assigned_user_id) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- ============================================
-- STEP 13: ROUTE LOCATIONS RLS POLICIES
-- ============================================

-- Only allow location tracking during active route sessions
DROP POLICY IF EXISTS "Users can view route locations" ON route_locations;
CREATE POLICY "Users can view route locations"
  ON route_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM routes r
      WHERE r.id = route_locations.route_id
      AND r.status = 'in_progress'
      AND (
        COALESCE(r.assigned_to, r.assigned_user_id) = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() 
          AND role = 'admin'
        )
        OR (
          EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'manager'
          )
          AND COALESCE(r.assigned_to, r.assigned_user_id) IS NOT NULL
          AND is_team_member(auth.uid(), COALESCE(r.assigned_to, r.assigned_user_id))
        )
      )
    )
  );

-- Only allow inserting locations if route is active and location tracking enabled
DROP POLICY IF EXISTS "Users can record locations during active routes" ON route_locations;
CREATE POLICY "Users can record locations during active routes"
  ON route_locations FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM routes r
      WHERE r.id = route_locations.route_id
      AND r.status = 'in_progress'
      AND r.location_tracking_enabled = TRUE
      AND COALESCE(r.assigned_to, r.assigned_user_id) = auth.uid()
    )
  );

-- ============================================
-- STEP 14: AUDIT LOG TRIGGERS
-- ============================================

-- Trigger function for deal stage changes
CREATE OR REPLACE FUNCTION audit_deal_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  RAISE NOTICE '[DEBUG-HYP-E] audit_deal_stage_change called';
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    PERFORM emit_audit_log(
      'deal.stage_change',
      auth.uid(),
      'deal',
      NEW.id,
      jsonb_build_object('stage', OLD.stage, 'win_reason', OLD.win_reason, 'loss_reason', OLD.loss_reason),
      jsonb_build_object('stage', NEW.stage, 'win_reason', NEW.win_reason, 'loss_reason', NEW.loss_reason),
      NULL
    );
  END IF;
  
  IF OLD.win_reason IS DISTINCT FROM NEW.win_reason OR OLD.loss_reason IS DISTINCT FROM NEW.loss_reason THEN
    PERFORM emit_audit_log(
      'deal.win_loss_reason_change',
      auth.uid(),
      'deal',
      NEW.id,
      jsonb_build_object('win_reason', OLD.win_reason, 'loss_reason', OLD.loss_reason),
      jsonb_build_object('win_reason', NEW.win_reason, 'loss_reason', NEW.loss_reason),
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_audit_deal_stage_change ON deals;
CREATE TRIGGER trigger_audit_deal_stage_change
  AFTER UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION audit_deal_stage_change();

-- Trigger function for quote status changes
CREATE OR REPLACE FUNCTION audit_quote_status_change()
RETURNS TRIGGER AS $$
DECLARE
  after_state JSONB;
  approved_by_val UUID;
  col_exists BOOLEAN;
  quote_id_val UUID;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Store NEW.id in a variable to avoid issues with format strings
    quote_id_val := NEW.id;
    
    -- Build after_state with status
    after_state := jsonb_build_object('status', NEW.status);
    
    -- Check if approved_by column exists and try to get its value
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'quotes' AND column_name = 'approved_by'
    ) INTO col_exists;
    
    -- Try to get approved_by value if column exists (query the table directly)
    IF col_exists THEN
      BEGIN
        -- Query the table directly to get approved_by value using the quote id
        EXECUTE 'SELECT approved_by FROM quotes WHERE id = $1' USING quote_id_val INTO approved_by_val;
        
        IF approved_by_val IS NOT NULL THEN
          after_state := after_state || jsonb_build_object('approved_by', approved_by_val);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- If approved_by doesn't exist or can't be accessed, just keep status
        NULL;
      END;
    END IF;
    
    PERFORM emit_audit_log(
      CASE NEW.status
        WHEN 'sent' THEN 'quote.send'
        WHEN 'accepted' THEN 'quote.accept'
        WHEN 'rejected' THEN 'quote.reject'
        ELSE 'quote.status_change'
      END,
      auth.uid(),
      'quote',
      quote_id_val,
      jsonb_build_object('status', OLD.status),
      after_state,
      jsonb_build_object('deal_id', NEW.deal_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_audit_quote_status_change ON quotes;
CREATE TRIGGER trigger_audit_quote_status_change
  AFTER UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION audit_quote_status_change();

-- Trigger function for call recording access
CREATE OR REPLACE FUNCTION audit_call_recording_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log when a recording is accessed (on SELECT, we'll use a view or function)
  -- For now, we'll log on INSERT which indicates recording was uploaded/created
  PERFORM emit_audit_log(
    'call.recording_access',
    auth.uid(),
    'call',
    NEW.call_id,
    NULL,
    jsonb_build_object('recording_id', NEW.id, 'duration', NEW.duration),
    jsonb_build_object('action', 'upload')
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_audit_call_recording_access ON call_recordings;
CREATE TRIGGER trigger_audit_call_recording_access
  AFTER INSERT ON call_recordings
  FOR EACH ROW
  EXECUTE FUNCTION audit_call_recording_access();

-- Trigger function for route start/stop
CREATE OR REPLACE FUNCTION audit_route_start_stop()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'planned' AND NEW.status = 'in_progress' THEN
    PERFORM emit_audit_log(
      'route.start',
      auth.uid(),
      'route',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status, 'started_at', NEW.started_at, 'location_tracking_enabled', NEW.location_tracking_enabled),
      NULL
    );
  END IF;
  
  IF OLD.status = 'in_progress' AND NEW.status IN ('completed', 'cancelled') THEN
    PERFORM emit_audit_log(
      'route.stop',
      auth.uid(),
      'route',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status, 'completed_at', NEW.completed_at),
      NULL
    );
  END IF;
  
  IF OLD.location_tracking_enabled IS DISTINCT FROM NEW.location_tracking_enabled THEN
    PERFORM emit_audit_log(
      'route.location_permission_change',
      auth.uid(),
      'route',
      NEW.id,
      jsonb_build_object('location_tracking_enabled', OLD.location_tracking_enabled),
      jsonb_build_object('location_tracking_enabled', NEW.location_tracking_enabled),
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_audit_route_start_stop ON routes;
CREATE TRIGGER trigger_audit_route_start_stop
  AFTER UPDATE ON routes
  FOR EACH ROW
  EXECUTE FUNCTION audit_route_start_stop();

-- ============================================
-- STEP 15: COMPLIANCE ENFORCEMENT FUNCTIONS
-- ============================================

-- Function to check if call recording/transcript can be stored
CREATE OR REPLACE FUNCTION check_call_consent(call_id_param UUID, consent_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  has_consent BOOLEAN;
BEGIN
  IF consent_type = 'recording' THEN
    SELECT recording_consent INTO has_consent
    FROM calls
    WHERE id = call_id_param;
  ELSIF consent_type = 'transcript' THEN
    SELECT transcript_consent INTO has_consent
    FROM calls
    WHERE id = call_id_param;
  ELSE
    RAISE EXCEPTION 'Invalid consent type: %', consent_type;
  END IF;
  
  RETURN COALESCE(has_consent, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if location tracking is allowed (only during active route)
CREATE OR REPLACE FUNCTION check_location_tracking_allowed(route_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  route_record RECORD;
  assigned_user_uuid UUID;
BEGIN
  SELECT status, location_tracking_enabled, COALESCE(assigned_to, assigned_user_id) as assigned_user
  INTO route_record
  FROM routes
  WHERE id = route_id_param;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  assigned_user_uuid := route_record.assigned_user;
  
  -- Must be active route
  IF route_record.status != 'in_progress' THEN
    RETURN FALSE;
  END IF;
  
  -- Location tracking must be enabled
  IF route_record.location_tracking_enabled != TRUE THEN
    RETURN FALSE;
  END IF;
  
  -- User must be assigned to the route
  IF assigned_user_uuid != user_id_param THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_call_consent(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_location_tracking_allowed(UUID, UUID) TO authenticated;

-- ============================================
-- STEP 16: GRANT PERMISSIONS
-- ============================================

-- Grant basic permissions
GRANT SELECT, INSERT, UPDATE ON deals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON calls TO authenticated;
GRANT SELECT, INSERT ON call_recordings TO authenticated;
GRANT SELECT, INSERT ON call_transcripts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON routes TO authenticated;
GRANT SELECT, INSERT ON route_locations TO authenticated;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all sensitive actions';
COMMENT ON TABLE deals IS 'Sales deals with role-based access control';
COMMENT ON TABLE quotes IS 'Quotes linked to deals with approval workflow';
COMMENT ON TABLE calls IS 'Call records with consent management';
COMMENT ON TABLE call_recordings IS 'Call recordings only stored if consent enabled';
COMMENT ON TABLE call_transcripts IS 'Call transcripts only stored if consent enabled';
COMMENT ON TABLE routes IS 'Routes for field workers with location tracking';
COMMENT ON TABLE route_locations IS 'Location data only recorded during active route sessions';

COMMENT ON FUNCTION check_call_consent IS 'Enforces consent requirements before storing recordings/transcripts';
COMMENT ON FUNCTION check_location_tracking_allowed IS 'Enforces location tracking only during active route sessions';
