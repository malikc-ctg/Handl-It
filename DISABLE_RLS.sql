-- SIMPLE FIX: Disable RLS on all user management tables
-- Copy and paste this entire script into Supabase SQL Editor and run it

-- Disable RLS on user_profiles
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Disable RLS on user_invitations
ALTER TABLE user_invitations DISABLE ROW LEVEL SECURITY;

-- Disable RLS on worker_site_assignments
ALTER TABLE worker_site_assignments DISABLE ROW LEVEL SECURITY;

-- Verify it worked
SELECT 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('user_profiles', 'user_invitations', 'worker_site_assignments');

-- This should show rowsecurity = false for all three tables

















