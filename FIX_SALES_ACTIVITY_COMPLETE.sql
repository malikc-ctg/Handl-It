-- ============================================
-- COMPLETE FIX: Sales Activity System
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: Add columns to contacts table
-- ============================================
DO $$
BEGIN
  -- no_contact_streak
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'no_contact_streak') THEN
    ALTER TABLE contacts ADD COLUMN no_contact_streak INTEGER DEFAULT 0;
  END IF;

  -- total_contact_attempts
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'total_contact_attempts') THEN
    ALTER TABLE contacts ADD COLUMN total_contact_attempts INTEGER DEFAULT 0;
  END IF;

  -- last_contact_attempt_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'last_contact_attempt_at') THEN
    ALTER TABLE contacts ADD COLUMN last_contact_attempt_at TIMESTAMPTZ;
  END IF;

  -- last_contact_result
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'last_contact_result') THEN
    ALTER TABLE contacts ADD COLUMN last_contact_result TEXT;
  END IF;

  -- last_contacted_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'last_contacted_at') THEN
    ALTER TABLE contacts ADD COLUMN last_contacted_at TIMESTAMPTZ;
  END IF;

  -- contact_status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'contact_status') THEN
    ALTER TABLE contacts ADD COLUMN contact_status TEXT DEFAULT 'new';
  END IF;

  -- assigned_user_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'assigned_user_id') THEN
    ALTER TABLE contacts ADD COLUMN assigned_user_id UUID;
  END IF;

  -- next_follow_up_date
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'next_follow_up_date') THEN
    ALTER TABLE contacts ADD COLUMN next_follow_up_date TIMESTAMPTZ;
  END IF;

  -- next_follow_up_type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'next_follow_up_type') THEN
    ALTER TABLE contacts ADD COLUMN next_follow_up_type TEXT;
  END IF;

  -- lost_reason
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'lost_reason') THEN
    ALTER TABLE contacts ADD COLUMN lost_reason TEXT;
  END IF;

  -- lost_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'lost_at') THEN
    ALTER TABLE contacts ADD COLUMN lost_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================
-- PART 2: Create sales_activities table
-- ============================================
CREATE TABLE IF NOT EXISTS sales_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'walkthrough', 'note', 'task')),
  outcome TEXT CHECK (outcome IN ('contact_made', 'no_contact', 'voicemail', 'scheduled', 'completed', 'cancelled')),
  notes TEXT,
  next_action_date TIMESTAMPTZ,
  next_action_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE
);

-- ============================================
-- PART 3: Enable RLS and create policies
-- ============================================
ALTER TABLE sales_activities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view activities in their company" ON sales_activities;
DROP POLICY IF EXISTS "Users can insert activities in their company" ON sales_activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON sales_activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON sales_activities;

-- Create policies
CREATE POLICY "Users can view activities in their company" ON sales_activities
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert activities in their company" ON sales_activities
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own activities" ON sales_activities
  FOR UPDATE USING (assigned_user_id = auth.uid());

CREATE POLICY "Users can delete their own activities" ON sales_activities
  FOR DELETE USING (assigned_user_id = auth.uid());

-- ============================================
-- PART 4: Create indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sales_activities_contact ON sales_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_sales_activities_deal ON sales_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_sales_activities_user ON sales_activities(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_sales_activities_created ON sales_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_no_contact_streak ON contacts(no_contact_streak) WHERE no_contact_streak > 0;
CREATE INDEX IF NOT EXISTS idx_contacts_next_follow_up ON contacts(next_follow_up_date) WHERE next_follow_up_date IS NOT NULL;

-- ============================================
-- PART 5: Update contacts RLS to allow updates
-- ============================================
DROP POLICY IF EXISTS "Users can update contacts in their company" ON contacts;

CREATE POLICY "Users can update contacts in their company" ON contacts
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

SELECT 'Sales Activity System setup complete!' as status;
