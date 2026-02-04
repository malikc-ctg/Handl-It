-- ============================================
-- Assign existing deals and contacts to their respective users
-- Run in Supabase SQL Editor so Priority Actions and filters show "my" items correctly.
-- ============================================

-- 1. DEALS: Ensure columns exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'created_by') THEN
    ALTER TABLE deals ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added deals.created_by';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'assigned_user_id') THEN
    ALTER TABLE deals ADD COLUMN assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added deals.assigned_user_id';
  END IF;
END $$;

-- 2. DEALS: Backfill from existing columns (assigned_to is legacy name in some schemas)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'assigned_to') THEN
    UPDATE deals SET assigned_user_id = COALESCE(assigned_user_id, assigned_to) WHERE assigned_user_id IS NULL AND assigned_to IS NOT NULL;
    UPDATE deals SET created_by = COALESCE(created_by, assigned_to) WHERE created_by IS NULL AND assigned_to IS NOT NULL;
  END IF;
  -- Assignee = creator when assignee is missing
  UPDATE deals SET assigned_user_id = created_by WHERE assigned_user_id IS NULL AND created_by IS NOT NULL;
  -- Creator = assignee when creator is missing (so "my deals" filter works both ways)
  UPDATE deals SET created_by = assigned_user_id WHERE created_by IS NULL AND assigned_user_id IS NOT NULL;
END $$;

-- 3. CONTACTS: Ensure columns exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'created_by') THEN
    ALTER TABLE contacts ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added contacts.created_by';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'assigned_user_id') THEN
    ALTER TABLE contacts ADD COLUMN assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added contacts.assigned_user_id';
  END IF;
END $$;

-- 4. CONTACTS: Backfill assignee from creator so "my contacts" is consistent
UPDATE contacts SET assigned_user_id = created_by WHERE assigned_user_id IS NULL AND created_by IS NOT NULL;
UPDATE contacts SET created_by = assigned_user_id WHERE created_by IS NULL AND assigned_user_id IS NOT NULL;

-- 5. Indexes for filtering by owner (optional, safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_deals_assigned_user_id ON deals(assigned_user_id) WHERE assigned_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_created_by ON deals(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_user_id ON contacts(assigned_user_id) WHERE assigned_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_created_by ON contacts(created_by) WHERE created_by IS NOT NULL;

SELECT 'Deals and contacts assignment backfill complete.' AS status;
