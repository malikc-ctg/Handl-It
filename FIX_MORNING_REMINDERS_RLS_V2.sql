-- ============================================
-- Fix RLS Policy for Morning Reminders (Version 2)
-- ============================================
-- This uses a more permissive approach to allow service role
-- ============================================

-- First, let's see what policies exist
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'notifications' AND cmd = 'INSERT';

-- Drop ALL existing INSERT policies
DROP POLICY IF EXISTS "Super admin and system can insert notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "System and users can insert notifications" ON notifications;

-- Create a completely permissive policy for INSERT
-- This allows service role (NULL auth.uid()) to insert
CREATE POLICY "Allow all inserts to notifications" ON notifications
FOR INSERT 
WITH CHECK (true);  -- Allow everything - service role will use this

-- Also ensure service_role has direct permissions
GRANT INSERT ON notifications TO service_role;

-- Verify
SELECT 
  'Policy Status' as check_type,
  policyname,
  cmd,
  CASE 
    WHEN with_check = 'true' THEN '✅ Permissive'
    ELSE with_check
  END as policy_check
FROM pg_policies
WHERE tablename = 'notifications' AND cmd = 'INSERT';

SELECT '✅ RLS policy updated! Service role can now insert notifications.' AS status;
