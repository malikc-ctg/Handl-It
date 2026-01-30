-- ============================================
-- FIX: Add missing columns to contacts table
-- Run this in Supabase SQL Editor
-- ============================================

-- Add columns one by one with IF NOT EXISTS
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

  -- quote_sent_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'quote_sent_at') THEN
    ALTER TABLE contacts ADD COLUMN quote_sent_at TIMESTAMPTZ;
  END IF;

  -- walkthrough_completed_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'walkthrough_completed_at') THEN
    ALTER TABLE contacts ADD COLUMN walkthrough_completed_at TIMESTAMPTZ;
  END IF;

  -- walkthrough_scheduled_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'walkthrough_scheduled_at') THEN
    ALTER TABLE contacts ADD COLUMN walkthrough_scheduled_at TIMESTAMPTZ;
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

  -- converted_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'converted_at') THEN
    ALTER TABLE contacts ADD COLUMN converted_at TIMESTAMPTZ;
  END IF;

  -- created_by (if missing)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'created_by') THEN
    ALTER TABLE contacts ADD COLUMN created_by UUID;
  END IF;
END $$;

-- Add columns to deals table too
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'quote_sent_at') THEN
    ALTER TABLE deals ADD COLUMN quote_sent_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'walkthrough_completed_at') THEN
    ALTER TABLE deals ADD COLUMN walkthrough_completed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'stage_entered_at') THEN
    ALTER TABLE deals ADD COLUMN stage_entered_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contacts_no_contact_streak ON contacts(no_contact_streak) WHERE no_contact_streak > 0;
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_user ON contacts(assigned_user_id) WHERE assigned_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(contact_status);
CREATE INDEX IF NOT EXISTS idx_contacts_next_follow_up ON contacts(next_follow_up_date) WHERE next_follow_up_date IS NOT NULL;

SELECT 'Columns added successfully!' as status;
