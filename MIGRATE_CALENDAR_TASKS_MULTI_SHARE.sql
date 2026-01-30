-- ============================================
-- Migrate calendar_tasks to support multi-share
-- ============================================
-- Run in Supabase Dashboard → SQL Editor
-- ============================================

-- Add the new shared_with column (UUID array)
ALTER TABLE calendar_tasks ADD COLUMN IF NOT EXISTS shared_with UUID[] DEFAULT '{}';

-- Migrate existing assigned_to data to shared_with array
UPDATE calendar_tasks 
SET shared_with = ARRAY[assigned_to] 
WHERE assigned_to IS NOT NULL 
  AND (shared_with IS NULL OR shared_with = '{}');

-- Drop the old assigned_to column (optional - can keep for backward compat)
-- ALTER TABLE calendar_tasks DROP COLUMN IF EXISTS assigned_to;

-- Create index for array lookups
DROP INDEX IF EXISTS idx_calendar_tasks_shared_with;
CREATE INDEX idx_calendar_tasks_shared_with ON calendar_tasks USING GIN(shared_with);

-- Update RLS policies for array-based sharing
DROP POLICY IF EXISTS "Users can view own or assigned calendar_tasks" ON calendar_tasks;
DROP POLICY IF EXISTS "Users can view own or shared calendar_tasks" ON calendar_tasks;
CREATE POLICY "Users can view own or shared calendar_tasks" ON calendar_tasks
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      created_by = auth.uid() OR
      auth.uid() = ANY(shared_with) OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    )
  );

DROP POLICY IF EXISTS "Users can update own or assigned calendar_tasks" ON calendar_tasks;
DROP POLICY IF EXISTS "Users can update own or shared calendar_tasks" ON calendar_tasks;
CREATE POLICY "Users can update own or shared calendar_tasks" ON calendar_tasks
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      created_by = auth.uid() OR
      auth.uid() = ANY(shared_with) OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    )
  );

SELECT 'Migration complete - shared_with column added' AS status;
