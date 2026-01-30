-- ============================================
-- COMPLETE FIX for calendar_tasks table
-- ============================================
-- Run in Supabase Dashboard → SQL Editor
-- ============================================

-- Step 1: Check if table exists, create if not
CREATE TABLE IF NOT EXISTS calendar_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  due_datetime TIMESTAMPTZ,
  is_all_day BOOLEAN NOT NULL DEFAULT true,
  estimated_hours NUMERIC(5,2) DEFAULT 1,
  shared_with UUID[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Add shared_with column if missing (for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calendar_tasks' AND column_name = 'shared_with'
  ) THEN
    ALTER TABLE calendar_tasks ADD COLUMN shared_with UUID[] DEFAULT '{}';
  END IF;
END $$;

-- Step 3: Migrate old assigned_to data if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calendar_tasks' AND column_name = 'assigned_to'
  ) THEN
    UPDATE calendar_tasks 
    SET shared_with = ARRAY[assigned_to] 
    WHERE assigned_to IS NOT NULL 
      AND (shared_with IS NULL OR shared_with = '{}');
  END IF;
END $$;

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_created_by ON calendar_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_due_date ON calendar_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_status ON calendar_tasks(status);

-- Step 5: Enable RLS
ALTER TABLE calendar_tasks ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop ALL existing policies (clean slate)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'calendar_tasks'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON calendar_tasks', pol.policyname);
  END LOOP;
END $$;

-- Step 7: Create fresh policies

-- SELECT policy
CREATE POLICY "calendar_tasks_select" ON calendar_tasks
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid() OR
    auth.uid() = ANY(shared_with) OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- INSERT policy  
CREATE POLICY "calendar_tasks_insert" ON calendar_tasks
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- UPDATE policy
CREATE POLICY "calendar_tasks_update" ON calendar_tasks
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid() OR
    auth.uid() = ANY(shared_with) OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- DELETE policy
CREATE POLICY "calendar_tasks_delete" ON calendar_tasks
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Step 8: Grant permissions to authenticated users
GRANT ALL ON calendar_tasks TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Verify
SELECT 'calendar_tasks setup complete' AS status,
       (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'calendar_tasks') AS policy_count;
