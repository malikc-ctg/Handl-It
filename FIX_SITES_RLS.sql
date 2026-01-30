-- Fix Sites RLS Policy - Allow ALL admins to see ALL sites
-- Run this in Supabase SQL Editor

-- =============================================
-- STEP 1: Drop ALL existing sites policies
-- =============================================
DROP POLICY IF EXISTS "Users can view sites" ON sites;
DROP POLICY IF EXISTS "Super admin and owners can view sites" ON sites;
DROP POLICY IF EXISTS "Enable select for own sites" ON sites;
DROP POLICY IF EXISTS "Clients can view own sites" ON sites;
DROP POLICY IF EXISTS "Admins can view all sites, others see own/assigned" ON sites;
DROP POLICY IF EXISTS "sites_select_policy" ON sites;
DROP POLICY IF EXISTS "Allow authenticated users to view sites" ON sites;
DROP POLICY IF EXISTS "Allow authenticated to select sites" ON sites;
DROP POLICY IF EXISTS "Users can insert sites" ON sites;
DROP POLICY IF EXISTS "Super admin and authenticated can insert sites" ON sites;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON sites;
DROP POLICY IF EXISTS "Admins and authenticated users can insert sites" ON sites;
DROP POLICY IF EXISTS "sites_insert_policy" ON sites;
DROP POLICY IF EXISTS "Allow authenticated to insert sites" ON sites;
DROP POLICY IF EXISTS "Users can update sites" ON sites;
DROP POLICY IF EXISTS "Super admin and owners can update sites" ON sites;
DROP POLICY IF EXISTS "Admins can update all sites, others need ownership/assignment" ON sites;
DROP POLICY IF EXISTS "sites_update_policy" ON sites;
DROP POLICY IF EXISTS "Allow authenticated to update sites" ON sites;
DROP POLICY IF EXISTS "Users can delete sites" ON sites;
DROP POLICY IF EXISTS "Super admin and owners can delete sites" ON sites;
DROP POLICY IF EXISTS "Admins can delete all sites, others need ownership" ON sites;
DROP POLICY IF EXISTS "sites_delete_policy" ON sites;
DROP POLICY IF EXISTS "Allow authenticated to delete sites" ON sites;

-- =============================================
-- STEP 2: Enable RLS
-- =============================================
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- =============================================
-- STEP 3: Create new policies
-- ALL authenticated users (admins) can see ALL sites
-- =============================================

-- Drop new policies if they exist (in case of re-run)
DROP POLICY IF EXISTS "All users can view all sites" ON sites;
DROP POLICY IF EXISTS "All users can create sites" ON sites;
DROP POLICY IF EXISTS "All users can update sites" ON sites;
DROP POLICY IF EXISTS "All users can delete sites" ON sites;

-- SELECT: All authenticated users can view ALL sites
CREATE POLICY "All users can view all sites"
ON sites FOR SELECT
TO authenticated
USING (true);

-- INSERT: All authenticated users can create sites
CREATE POLICY "All users can create sites"
ON sites FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE: All authenticated users can update sites
CREATE POLICY "All users can update sites"
ON sites FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- DELETE: All authenticated users can delete sites
CREATE POLICY "All users can delete sites"
ON sites FOR DELETE
TO authenticated
USING (true);

-- =============================================
-- STEP 4: Verify policies
-- =============================================
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'sites'
ORDER BY cmd;
