-- ============================================
-- SALES ACTIVITIES & 3 NO'S POLICY SETUP
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. ADD CONTACT TRACKING COLUMNS TO DEALS
-- ============================================
ALTER TABLE deals ADD COLUMN IF NOT EXISTS no_contact_streak INTEGER DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS total_contact_attempts INTEGER DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_contact_attempt_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_contact_result TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS quote_sent_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS walkthrough_completed_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS walkthrough_scheduled_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE deals ADD COLUMN IF NOT EXISTS days_in_current_stage INTEGER DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS primary_contact_id UUID;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS account_id UUID;

-- Add lost_reason as TEXT if not exists (may already exist as enum)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'lost_reason_text') THEN
    ALTER TABLE deals ADD COLUMN lost_reason_text TEXT;
  END IF;
END $$;

-- ============================================
-- 2. CREATE SALES ACTIVITIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sales_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  contact_id UUID,
  assigned_user_id UUID REFERENCES auth.users(id), -- User responsible for this activity
  
  -- Activity details
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'call', 'email', 'meeting', 'walkthrough', 'quote_sent', 
    'voicemail', 'text', 'site_visit', 'follow_up', 'other'
  )),
  outcome TEXT NOT NULL CHECK (outcome IN (
    'contact_made', 'no_contact', 'voicemail', 'email_sent', 
    'scheduled', 'completed', 'cancelled', 'rescheduled'
  )),
  
  -- Details
  notes TEXT,
  duration_minutes INTEGER,
  
  -- Follow-up scheduling
  next_action_date TIMESTAMPTZ,
  next_action_type TEXT CHECK (next_action_type IN (
    'call', 'email', 'meeting', 'walkthrough', 'quote', 'follow_up', 'close', 'none'
  )),
  next_action_notes TEXT,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. CREATE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_deals_no_contact_streak ON deals(no_contact_streak) WHERE no_contact_streak > 0;
CREATE INDEX IF NOT EXISTS idx_deals_stage_entered ON deals(stage_entered_at);
CREATE INDEX IF NOT EXISTS idx_deals_last_contact ON deals(last_contact_attempt_at);
CREATE INDEX IF NOT EXISTS idx_deals_quote_sent ON deals(quote_sent_at) WHERE quote_sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_walkthrough ON deals(walkthrough_scheduled_at) WHERE walkthrough_scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_activities_deal ON sales_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_sales_activities_contact ON sales_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_sales_activities_created ON sales_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_activities_type ON sales_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_sales_activities_next_action ON sales_activities(next_action_date) WHERE next_action_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_activities_assigned ON sales_activities(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_sales_activities_created_by ON sales_activities(created_by);

-- Index for user-specific deal queries
CREATE INDEX IF NOT EXISTS idx_deals_assigned_user ON deals(assigned_user_id) WHERE assigned_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON deals(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_created_by ON deals(created_by) WHERE created_by IS NOT NULL;

-- ============================================
-- 4. ENABLE RLS ON SALES ACTIVITIES
-- ============================================
ALTER TABLE sales_activities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their company's activities" ON sales_activities;
DROP POLICY IF EXISTS "Users can create activities" ON sales_activities;
DROP POLICY IF EXISTS "Users can update their activities" ON sales_activities;
DROP POLICY IF EXISTS "Users can delete their activities" ON sales_activities;

-- Create RLS policies
CREATE POLICY "Users can view their company's activities" ON sales_activities
  FOR SELECT USING (
    -- User created the activity
    created_by = auth.uid()
    -- Or user is assigned to the activity
    OR assigned_user_id = auth.uid()
    -- Or user is in the same company
    OR company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
    -- Or user owns/is assigned to the related deal
    OR deal_id IN (
      SELECT id FROM deals WHERE 
        assigned_user_id = auth.uid() 
        OR assigned_to = auth.uid()
        OR created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create activities" ON sales_activities
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
  );

CREATE POLICY "Users can update their activities" ON sales_activities
  FOR UPDATE USING (
    created_by = auth.uid()
    OR assigned_user_id = auth.uid()
  );

CREATE POLICY "Users can delete their activities" ON sales_activities
  FOR DELETE USING (
    created_by = auth.uid()
  );

-- Grant access
GRANT ALL ON sales_activities TO authenticated;

-- ============================================
-- 5. FUNCTION: LOG ACTIVITY WITH 3 NO'S LOGIC
-- ============================================
CREATE OR REPLACE FUNCTION log_sales_activity(
  p_deal_id UUID,
  p_activity_type TEXT,
  p_outcome TEXT,
  p_notes TEXT DEFAULT NULL,
  p_next_action_date TIMESTAMPTZ DEFAULT NULL,
  p_next_action_type TEXT DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deal RECORD;
  v_new_streak INTEGER;
  v_activity_id UUID;
  v_auto_closed BOOLEAN := FALSE;
  v_company_id UUID;
BEGIN
  -- Get current deal info
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id;
  
  IF v_deal IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deal not found');
  END IF;
  
  -- Get company_id from deal's workspace_id
  v_company_id := v_deal.workspace_id;
  
  -- Calculate new streak based on outcome
  IF p_outcome IN ('contact_made', 'completed', 'scheduled') THEN
    -- Successful contact - reset streak
    v_new_streak := 0;
  ELSIF p_outcome IN ('no_contact', 'voicemail') THEN
    -- Failed contact - increment streak
    v_new_streak := COALESCE(v_deal.no_contact_streak, 0) + 1;
  ELSE
    -- Other outcomes - keep current streak
    v_new_streak := COALESCE(v_deal.no_contact_streak, 0);
  END IF;
  
  -- Insert activity record
  INSERT INTO sales_activities (
    company_id,
    deal_id,
    assigned_user_id,
    activity_type,
    outcome,
    notes,
    duration_minutes,
    next_action_date,
    next_action_type,
    created_by
  ) VALUES (
    v_company_id,
    p_deal_id,
    COALESCE(v_deal.assigned_user_id, v_deal.assigned_to, auth.uid()), -- Assign to deal owner or current user
    p_activity_type,
    p_outcome,
    p_notes,
    p_duration_minutes,
    p_next_action_date,
    p_next_action_type,
    auth.uid()
  )
  RETURNING id INTO v_activity_id;
  
  -- Update deal with new tracking info
  UPDATE deals SET
    no_contact_streak = v_new_streak,
    total_contact_attempts = COALESCE(total_contact_attempts, 0) + 1,
    last_contact_attempt_at = NOW(),
    last_contact_result = p_outcome,
    last_touch_at = NOW(),
    updated_at = NOW()
  WHERE id = p_deal_id;
  
  -- Check if we hit 3 no-contacts and auto-close
  IF v_new_streak >= 3 AND v_deal.stage NOT IN ('closed_won', 'closed_lost') THEN
    UPDATE deals SET
      stage = 'closed_lost',
      lost_at = NOW(),
      lost_reason_text = 'No response after 3 contact attempts',
      updated_at = NOW()
    WHERE id = p_deal_id;
    v_auto_closed := TRUE;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'activity_id', v_activity_id,
    'new_streak', v_new_streak,
    'auto_closed', v_auto_closed,
    'total_attempts', COALESCE(v_deal.total_contact_attempts, 0) + 1
  );
END;
$$;

-- ============================================
-- 6. FUNCTION: GET DEAL ACTIVITIES
-- ============================================
CREATE OR REPLACE FUNCTION get_deal_activities(p_deal_id UUID, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  id UUID,
  activity_type TEXT,
  outcome TEXT,
  notes TEXT,
  duration_minutes INTEGER,
  next_action_date TIMESTAMPTZ,
  next_action_type TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  created_by_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sa.id,
    sa.activity_type,
    sa.outcome,
    sa.notes,
    sa.duration_minutes,
    sa.next_action_date,
    sa.next_action_type,
    sa.created_by,
    sa.created_at,
    COALESCE(up.full_name, up.email, 'Unknown') as created_by_name
  FROM sales_activities sa
  LEFT JOIN user_profiles up ON up.id = sa.created_by
  WHERE sa.deal_id = p_deal_id
  ORDER BY sa.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ============================================
-- 7. FUNCTION: UPDATE STAGE TRACKING
-- ============================================
CREATE OR REPLACE FUNCTION update_deal_stage_tracking()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    NEW.stage_entered_at := NOW();
    NEW.days_in_current_stage := 0;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for stage tracking
DROP TRIGGER IF EXISTS deal_stage_tracking_trigger ON deals;
CREATE TRIGGER deal_stage_tracking_trigger
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_stage_tracking();

-- ============================================
-- 8. VIEW: PRIORITY ACTIONS (User-specific)
-- ============================================
CREATE OR REPLACE VIEW priority_actions_view AS
WITH deal_priorities AS (
  SELECT 
    d.id as deal_id,
    d.title as company_name,
    COALESCE(d.value_estimate, 0) as deal_value,
    d.stage,
    d.no_contact_streak,
    d.total_contact_attempts,
    d.last_contact_attempt_at,
    d.last_touch_at,
    d.quote_sent_at,
    d.walkthrough_scheduled_at,
    d.walkthrough_completed_at,
    d.stage_entered_at,
    d.workspace_id,
    d.assigned_user_id,
    d.assigned_to,
    d.created_by,
    
    -- Calculate priority level and action
    CASE
      -- P1: Urgent - 2 no contacts (final attempt needed)
      WHEN d.no_contact_streak = 2 THEN 1
      -- P1: Quote expiring soon (handled separately)
      -- P2: 1 no contact
      WHEN d.no_contact_streak = 1 THEN 2
      -- P2: Walkthrough completed but no quote sent
      WHEN d.walkthrough_completed_at IS NOT NULL 
           AND d.quote_sent_at IS NULL 
           AND d.stage NOT IN ('closed_won', 'closed_lost') THEN 2
      -- P3: Idle > 7 days
      WHEN d.last_touch_at < NOW() - INTERVAL '7 days' 
           AND d.stage NOT IN ('closed_won', 'closed_lost') THEN 3
      -- P3: Stuck in stage > 14 days
      WHEN d.stage_entered_at < NOW() - INTERVAL '14 days'
           AND d.stage NOT IN ('closed_won', 'closed_lost') THEN 3
      -- P3: No contact attempts on new deal
      WHEN d.total_contact_attempts = 0 
           AND d.stage NOT IN ('closed_won', 'closed_lost') THEN 3
      ELSE 4
    END as priority_level,
    
    CASE
      WHEN d.no_contact_streak = 2 THEN 'FINAL ATTEMPT - 2 no contacts in a row'
      WHEN d.no_contact_streak = 1 THEN 'Follow up - 1 no contact'
      WHEN d.walkthrough_completed_at IS NOT NULL AND d.quote_sent_at IS NULL THEN 'Send quote after walkthrough'
      WHEN d.last_touch_at < NOW() - INTERVAL '7 days' THEN 'Re-engage - idle ' || EXTRACT(DAY FROM NOW() - d.last_touch_at)::INTEGER || ' days'
      WHEN d.stage_entered_at < NOW() - INTERVAL '14 days' THEN 'Stuck in stage - move forward or disqualify'
      WHEN d.total_contact_attempts = 0 THEN 'New deal - make first contact'
      ELSE 'Review deal'
    END as action_reason
    
  FROM deals d
  WHERE d.stage NOT IN ('closed_won', 'closed_lost')
    -- Filter by user assignment (user sees only their deals)
    AND (
      d.assigned_user_id = auth.uid()
      OR d.assigned_to = auth.uid()
      OR d.created_by = auth.uid()
      -- Or user is admin/manager in the same workspace
      OR EXISTS (
        SELECT 1 FROM user_profiles up 
        WHERE up.id = auth.uid() 
        AND up.company_id = d.workspace_id 
        AND up.role IN ('admin', 'owner', 'manager')
      )
    )
)
SELECT * FROM deal_priorities
WHERE priority_level <= 3
ORDER BY priority_level, deal_value DESC;

-- Grant access to view
GRANT SELECT ON priority_actions_view TO authenticated;

-- ============================================
-- DONE
-- ============================================
SELECT 'Sales Activities schema created successfully!' as status;
