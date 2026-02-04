-- ============================================
-- Sales Activity Timeline for Deals
-- Run in Supabase SQL Editor. Creates or updates sales_activities for deal timeline.
-- ============================================

-- Ensure sales_activities exists with deal-linked columns
CREATE TABLE IF NOT EXISTS sales_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  contact_id UUID,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'note', 'walkthrough', 'task')),
  outcome TEXT CHECK (outcome IN ('contact_made', 'no_contact', 'voicemail', 'scheduled', 'completed', 'cancelled', 'email_sent', 'rescheduled')),
  notes TEXT,
  activity_date TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if table already existed with different schema
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_activities' AND column_name = 'created_by') THEN
    ALTER TABLE sales_activities ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_activities' AND column_name = 'activity_date') THEN
    ALTER TABLE sales_activities ADD COLUMN activity_date TIMESTAMPTZ DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_activities' AND column_name = 'deal_id') THEN
    ALTER TABLE sales_activities ADD COLUMN deal_id UUID REFERENCES deals(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_activities_deal_id ON sales_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_sales_activities_created_at ON sales_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_activities_created_by ON sales_activities(created_by);

-- RLS
ALTER TABLE sales_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sales activities: allow authenticated read" ON sales_activities;
DROP POLICY IF EXISTS "Sales activities: allow insert own" ON sales_activities;
DROP POLICY IF EXISTS "Sales activities: allow update own" ON sales_activities;
DROP POLICY IF EXISTS "Sales activities: allow delete own" ON sales_activities;

CREATE POLICY "Sales activities: allow authenticated read" ON sales_activities
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Sales activities: allow insert own" ON sales_activities
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND (created_by IS NULL OR created_by = auth.uid()));

CREATE POLICY "Sales activities: allow update own" ON sales_activities
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Sales activities: allow delete own" ON sales_activities
  FOR DELETE USING (created_by = auth.uid());

GRANT ALL ON sales_activities TO authenticated;

SELECT 'Sales activity timeline schema ready.' AS status;
