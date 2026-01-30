-- ============================================
-- SALES ACTIVITIES & 3 NO'S POLICY SETUP
-- CONTACT-BASED FOLLOW-UP SYSTEM
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. ADD CONTACT TRACKING COLUMNS TO CONTACTS
-- ============================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS no_contact_streak INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS total_contact_attempts INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contact_attempt_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contact_result TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS quote_sent_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS walkthrough_completed_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS walkthrough_scheduled_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_status TEXT DEFAULT 'new' CHECK (contact_status IN ('new', 'active', 'nurturing', 'lost', 'converted'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES auth.users(id);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_follow_up_date TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_follow_up_type TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lost_reason TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

-- Also add tracking to deals for deal-specific follow-ups
ALTER TABLE deals ADD COLUMN IF NOT EXISTS quote_sent_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS walkthrough_completed_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- 2. CREATE SALES ACTIVITIES TABLE (Contact-Centric)
-- ============================================
CREATE TABLE IF NOT EXISTS sales_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE, -- PRIMARY: linked to contact
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL, -- OPTIONAL: linked to specific deal
  account_id UUID, -- Optional: linked to account/company
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
-- Contact indexes for follow-up tracking
CREATE INDEX IF NOT EXISTS idx_contacts_no_contact_streak ON contacts(no_contact_streak) WHERE no_contact_streak > 0;
CREATE INDEX IF NOT EXISTS idx_contacts_last_contact ON contacts(last_contact_attempt_at);
CREATE INDEX IF NOT EXISTS idx_contacts_next_follow_up ON contacts(next_follow_up_date) WHERE next_follow_up_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(contact_status);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_user ON contacts(assigned_user_id) WHERE assigned_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_quote_sent ON contacts(quote_sent_at) WHERE quote_sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_walkthrough ON contacts(walkthrough_scheduled_at) WHERE walkthrough_scheduled_at IS NOT NULL;

-- Activity indexes
CREATE INDEX IF NOT EXISTS idx_sales_activities_contact ON sales_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_sales_activities_deal ON sales_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_sales_activities_created ON sales_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_activities_type ON sales_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_sales_activities_next_action ON sales_activities(next_action_date) WHERE next_action_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_activities_assigned ON sales_activities(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_sales_activities_created_by ON sales_activities(created_by);

-- Deal indexes (for deal-specific tracking)
CREATE INDEX IF NOT EXISTS idx_deals_quote_sent ON deals(quote_sent_at) WHERE quote_sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_stage_entered ON deals(stage_entered_at);

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
    -- Or user is assigned to the related contact
    OR contact_id IN (
      SELECT id FROM contacts WHERE 
        assigned_user_id = auth.uid() 
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
-- 5. FUNCTION: LOG ACTIVITY WITH 3 NO'S LOGIC (Contact-Based)
-- ============================================
CREATE OR REPLACE FUNCTION log_contact_activity(
  p_contact_id UUID,
  p_activity_type TEXT,
  p_outcome TEXT,
  p_notes TEXT DEFAULT NULL,
  p_next_action_date TIMESTAMPTZ DEFAULT NULL,
  p_next_action_type TEXT DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT NULL,
  p_deal_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contact RECORD;
  v_new_streak INTEGER;
  v_activity_id UUID;
  v_auto_lost BOOLEAN := FALSE;
  v_company_id UUID;
BEGIN
  -- Get current contact info
  SELECT * INTO v_contact FROM contacts WHERE id = p_contact_id;
  
  IF v_contact IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contact not found');
  END IF;
  
  -- Get company_id from contact
  v_company_id := v_contact.company_id;
  
  -- Calculate new streak based on outcome
  IF p_outcome IN ('contact_made', 'completed', 'scheduled') THEN
    -- Successful contact - reset streak
    v_new_streak := 0;
  ELSIF p_outcome IN ('no_contact', 'voicemail') THEN
    -- Failed contact - increment streak
    v_new_streak := COALESCE(v_contact.no_contact_streak, 0) + 1;
  ELSE
    -- Other outcomes - keep current streak
    v_new_streak := COALESCE(v_contact.no_contact_streak, 0);
  END IF;
  
  -- Insert activity record
  INSERT INTO sales_activities (
    company_id,
    contact_id,
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
    p_contact_id,
    p_deal_id,
    COALESCE(v_contact.assigned_user_id, auth.uid()),
    p_activity_type,
    p_outcome,
    p_notes,
    p_duration_minutes,
    p_next_action_date,
    p_next_action_type,
    auth.uid()
  )
  RETURNING id INTO v_activity_id;
  
  -- Update contact with new tracking info
  UPDATE contacts SET
    no_contact_streak = v_new_streak,
    total_contact_attempts = COALESCE(total_contact_attempts, 0) + 1,
    last_contact_attempt_at = NOW(),
    last_contact_result = p_outcome,
    last_contacted_at = CASE WHEN p_outcome = 'contact_made' THEN NOW() ELSE last_contacted_at END,
    next_follow_up_date = p_next_action_date,
    next_follow_up_type = p_next_action_type,
    updated_at = NOW()
  WHERE id = p_contact_id;
  
  -- Check if we hit 3 no-contacts and auto-mark as lost
  IF v_new_streak >= 3 AND v_contact.contact_status NOT IN ('lost', 'converted') THEN
    UPDATE contacts SET
      contact_status = 'lost',
      lost_at = NOW(),
      lost_reason = 'No response after 3 contact attempts',
      updated_at = NOW()
    WHERE id = p_contact_id;
    v_auto_lost := TRUE;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'activity_id', v_activity_id,
    'new_streak', v_new_streak,
    'auto_lost', v_auto_lost,
    'total_attempts', COALESCE(v_contact.total_contact_attempts, 0) + 1
  );
END;
$$;

-- ============================================
-- 6. FUNCTION: GET CONTACT ACTIVITIES
-- ============================================
CREATE OR REPLACE FUNCTION get_contact_activities(p_contact_id UUID, p_limit INTEGER DEFAULT 20)
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
  WHERE sa.contact_id = p_contact_id
  ORDER BY sa.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ============================================
-- 7. FUNCTION: UPDATE CONTACT STATUS TRACKING
-- ============================================
CREATE OR REPLACE FUNCTION update_contact_status_tracking()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Track when contact becomes converted
  IF OLD.contact_status IS DISTINCT FROM NEW.contact_status THEN
    IF NEW.contact_status = 'converted' AND NEW.converted_at IS NULL THEN
      NEW.converted_at := NOW();
    END IF;
    IF NEW.contact_status = 'lost' AND NEW.lost_at IS NULL THEN
      NEW.lost_at := NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for contact status tracking
DROP TRIGGER IF EXISTS contact_status_tracking_trigger ON contacts;
CREATE TRIGGER contact_status_tracking_trigger
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_status_tracking();

-- Also keep deal stage tracking
CREATE OR REPLACE FUNCTION update_deal_stage_tracking()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    NEW.stage_entered_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deal_stage_tracking_trigger ON deals;
CREATE TRIGGER deal_stage_tracking_trigger
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_stage_tracking();

-- ============================================
-- 8. VIEW: CONTACT PRIORITY ACTIONS (User-specific)
-- ============================================
CREATE OR REPLACE VIEW contact_priority_actions_view AS
WITH contact_priorities AS (
  SELECT 
    c.id as contact_id,
    COALESCE(c.full_name, c.email, 'Unknown') as contact_name,
    c.email,
    c.phone,
    c.company_name,
    c.contact_status,
    c.no_contact_streak,
    c.total_contact_attempts,
    c.last_contact_attempt_at,
    c.last_contacted_at,
    c.quote_sent_at,
    c.walkthrough_scheduled_at,
    c.walkthrough_completed_at,
    c.next_follow_up_date,
    c.next_follow_up_type,
    c.company_id,
    c.assigned_user_id,
    c.created_by,
    
    -- Calculate priority level and action
    CASE
      -- P1: Urgent - 2 no contacts (final attempt needed)
      WHEN c.no_contact_streak = 2 THEN 1
      -- P1: Missed follow-up (scheduled follow-up date passed)
      WHEN c.next_follow_up_date < NOW() THEN 1
      -- P2: 1 no contact
      WHEN c.no_contact_streak = 1 THEN 2
      -- P2: Walkthrough completed but no quote sent
      WHEN c.walkthrough_completed_at IS NOT NULL 
           AND c.quote_sent_at IS NULL 
           AND c.contact_status NOT IN ('lost', 'converted') THEN 2
      -- P2: Quote sent, follow up needed (3-7 days)
      WHEN c.quote_sent_at IS NOT NULL 
           AND c.quote_sent_at > NOW() - INTERVAL '7 days'
           AND c.contact_status NOT IN ('lost', 'converted') THEN 2
      -- P3: Idle > 7 days
      WHEN c.last_contacted_at < NOW() - INTERVAL '7 days' 
           AND c.contact_status NOT IN ('lost', 'converted') THEN 3
      -- P3: No contact attempts on new contact
      WHEN COALESCE(c.total_contact_attempts, 0) = 0 
           AND c.contact_status NOT IN ('lost', 'converted') THEN 3
      ELSE 4
    END as priority_level,
    
    CASE
      WHEN c.no_contact_streak = 2 THEN 'FINAL ATTEMPT - 2 no contacts in a row'
      WHEN c.next_follow_up_date < NOW() THEN 'Missed follow-up - ' || c.next_follow_up_type
      WHEN c.no_contact_streak = 1 THEN 'Follow up - 1 no contact (attempt 2 of 3)'
      WHEN c.walkthrough_completed_at IS NOT NULL AND c.quote_sent_at IS NULL THEN 'Send quote after walkthrough'
      WHEN c.quote_sent_at IS NOT NULL AND c.quote_sent_at > NOW() - INTERVAL '3 days' THEN 'Quote follow-up - Day ' || EXTRACT(DAY FROM NOW() - c.quote_sent_at)::INTEGER
      WHEN c.quote_sent_at IS NOT NULL THEN 'Quote follow-up needed'
      WHEN c.last_contacted_at < NOW() - INTERVAL '7 days' THEN 'Re-engage - idle ' || EXTRACT(DAY FROM NOW() - c.last_contacted_at)::INTEGER || ' days'
      WHEN COALESCE(c.total_contact_attempts, 0) = 0 THEN 'New contact - make first contact'
      ELSE 'Review contact'
    END as action_reason
    
  FROM contacts c
  WHERE c.contact_status NOT IN ('lost', 'converted')
    -- Filter by user assignment (user sees only their contacts)
    AND (
      c.assigned_user_id = auth.uid()
      OR c.created_by = auth.uid()
      -- Or user is admin/manager in the same company
      OR EXISTS (
        SELECT 1 FROM user_profiles up 
        WHERE up.id = auth.uid() 
        AND up.company_id = c.company_id 
        AND up.role IN ('admin', 'owner', 'manager')
      )
    )
)
SELECT * FROM contact_priorities
WHERE priority_level <= 3
ORDER BY priority_level, last_contact_attempt_at ASC NULLS FIRST;

-- Grant access to view
GRANT SELECT ON contact_priority_actions_view TO authenticated;

-- ============================================
-- DONE
-- ============================================
SELECT 'Sales Activities schema created successfully!' as status;
