-- ============================================
-- Fix Permissions for Morning Reminders
-- ============================================
-- Error 42501 = permission denied
-- This grants direct permissions to service_role
-- ============================================

-- Check current grants
SELECT 
  'Current Grants' as check_type,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'notifications' AND table_schema = 'public';

-- Grant INSERT permission directly to service_role
GRANT INSERT ON notifications TO service_role;
GRANT SELECT ON notifications TO service_role;

-- Also grant to authenticated role (for users)
GRANT INSERT ON notifications TO authenticated;
GRANT SELECT ON notifications TO authenticated;

-- Verify RLS is enabled
SELECT 
  'RLS Status' as check_type,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'notifications';

-- Check all INSERT policies
SELECT 
  'INSERT Policies' as check_type,
  policyname,
  permissive,
  roles,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'notifications' AND cmd = 'INSERT';

-- If still not working, try disabling RLS temporarily for testing
-- (Uncomment the line below if needed, but re-enable after testing)
-- ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Verify grants were applied
SELECT 
  'Updated Grants' as check_type,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'notifications' 
  AND table_schema = 'public'
  AND grantee IN ('service_role', 'authenticated')
ORDER BY grantee, privilege_type;

SELECT '✅ Permissions updated! service_role now has INSERT permission.' AS status;
