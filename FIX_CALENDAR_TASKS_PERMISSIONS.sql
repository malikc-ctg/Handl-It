-- ============================================
-- Fix calendar_tasks permissions
-- ============================================
-- Run in Supabase Dashboard → SQL Editor
-- ============================================

-- Make sure RLS is enabled
ALTER TABLE calendar_tasks ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own or assigned calendar_tasks" ON calendar_tasks;
DROP POLICY IF EXISTS "Users can view own or shared calendar_tasks" ON calendar_tasks;
DROP POLICY IF EXISTS "Users can insert own calendar_tasks" ON calendar_tasks;
DROP POLICY IF EXISTS "Users can update own or assigned calendar_tasks" ON calendar_tasks;
DROP POLICY IF EXISTS "Users can update own or shared calendar_tasks" ON calendar_tasks;
DROP POLICY IF EXISTS "Users can delete own calendar_tasks" ON calendar_tasks;

-- SELECT: Users can view tasks they created or are shared with
CREATE POLICY "Users can view own or shared calendar_tasks" ON calendar_tasks
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      created_by = auth.uid() OR
      auth.uid() = ANY(shared_with) OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    )
  );

-- INSERT: Users can create their own tasks
CREATE POLICY "Users can insert own calendar_tasks" ON calendar_tasks
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND created_by = auth.uid()
  );

-- UPDATE: Users can update tasks they created or are shared with
CREATE POLICY "Users can update own or shared calendar_tasks" ON calendar_tasks
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      created_by = auth.uid() OR
      auth.uid() = ANY(shared_with) OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    )
  );

-- DELETE: Users can delete their own tasks
CREATE POLICY "Users can delete own calendar_tasks" ON calendar_tasks
  FOR DELETE USING (
    auth.role() = 'authenticated' AND created_by = auth.uid()
  );

SELECT 'calendar_tasks RLS policies fixed' AS status;
