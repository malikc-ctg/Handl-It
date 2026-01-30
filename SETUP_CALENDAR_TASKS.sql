-- ============================================
-- Calendar Tasks (task-only, no job functions)
-- ============================================
-- Run in Supabase Dashboard → SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS calendar_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  due_datetime TIMESTAMPTZ,
  is_all_day BOOLEAN NOT NULL DEFAULT true,
  estimated_hours NUMERIC(5,2) DEFAULT 1,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_tasks_created_by ON calendar_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_assigned_to ON calendar_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_due_date ON calendar_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_status ON calendar_tasks(status);

ALTER TABLE calendar_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own or assigned calendar_tasks" ON calendar_tasks;
CREATE POLICY "Users can view own or assigned calendar_tasks" ON calendar_tasks
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      created_by = auth.uid() OR
      assigned_to = auth.uid() OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    )
  );

DROP POLICY IF EXISTS "Users can insert own calendar_tasks" ON calendar_tasks;
CREATE POLICY "Users can insert own calendar_tasks" ON calendar_tasks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update own or assigned calendar_tasks" ON calendar_tasks;
CREATE POLICY "Users can update own or assigned calendar_tasks" ON calendar_tasks
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      created_by = auth.uid() OR
      assigned_to = auth.uid() OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    )
  );

DROP POLICY IF EXISTS "Users can delete own calendar_tasks" ON calendar_tasks;
CREATE POLICY "Users can delete own calendar_tasks" ON calendar_tasks
  FOR DELETE USING (auth.role() = 'authenticated' AND created_by = auth.uid());

SELECT 'calendar_tasks table and RLS ready' AS status;
