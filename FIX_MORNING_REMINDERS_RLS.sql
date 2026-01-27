-- ============================================
-- Fix RLS Policy for Morning Reminders
-- ============================================
-- The current RLS policy blocks service role inserts
-- This fixes it to allow the Edge Function to create notifications
-- ============================================

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Super admin and system can insert notifications" ON notifications;

-- Create a new policy that allows service role to insert
-- Service role has auth.uid() = NULL, so we need to allow that
CREATE POLICY "System and users can insert notifications" ON notifications
FOR INSERT WITH CHECK (
  -- Allow service role (auth.uid() is NULL for service role)
  auth.uid() IS NULL OR
  -- Allow super admin
  is_super_admin() OR
  -- Allow users to insert their own notifications
  user_id = auth.uid()
);

-- Verify the policy
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'notifications' AND policyname LIKE '%insert%';

SELECT '✅ RLS policy updated! Morning reminders should work now.' AS status;
