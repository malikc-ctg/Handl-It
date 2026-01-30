-- Fix Sites RLS Policy to allow users to view sites
-- Run this in Supabase SQL Editor

-- First, let's see what policies exist
-- SELECT * FROM pg_policies WHERE tablename = 'sites';

-- Drop all existing sites policies to start fresh
DROP POLICY IF EXISTS "Users can view sites" ON sites;
DROP POLICY IF EXISTS "Super admin and owners can view sites" ON sites;
DROP POLICY IF EXISTS "Enable select for own sites" ON sites;
DROP POLICY IF EXISTS "Clients can view own sites" ON sites;
DROP POLICY IF EXISTS "Admins can view all sites, others see own/assigned" ON sites;
DROP POLICY IF EXISTS "sites_select_policy" ON sites;
DROP POLICY IF EXISTS "Allow authenticated users to view sites" ON sites;

-- Drop insert policies
DROP POLICY IF EXISTS "Users can insert sites" ON sites;
DROP POLICY IF EXISTS "Super admin and authenticated can insert sites" ON sites;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON sites;
DROP POLICY IF EXISTS "Admins and authenticated users can insert sites" ON sites;
DROP POLICY IF EXISTS "sites_insert_policy" ON sites;

-- Drop update policies
DROP POLICY IF EXISTS "Users can update sites" ON sites;
DROP POLICY IF EXISTS "Super admin and owners can update sites" ON sites;
DROP POLICY IF EXISTS "Admins can update all sites, others need ownership/assignment" ON sites;
DROP POLICY IF EXISTS "sites_update_policy" ON sites;

-- Drop delete policies
DROP POLICY IF EXISTS "Users can delete sites" ON sites;
DROP POLICY IF EXISTS "Super admin and owners can delete sites" ON sites;
DROP POLICY IF EXISTS "Admins can delete all sites, others need ownership" ON sites;
DROP POLICY IF EXISTS "sites_delete_policy" ON sites;

-- Make sure RLS is enabled
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- Create simple, permissive policies for authenticated users
-- SELECT: Allow authenticated users to view all sites (company-level access controlled by app logic)
CREATE POLICY "Allow authenticated to select sites"
ON sites FOR SELECT
TO authenticated
USING (true);

-- INSERT: Allow authenticated users to create sites
CREATE POLICY "Allow authenticated to insert sites"
ON sites FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE: Allow authenticated users to update sites
CREATE POLICY "Allow authenticated to update sites"
ON sites FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- DELETE: Allow authenticated users to delete sites (restrict to creators if needed later)
CREATE POLICY "Allow authenticated to delete sites"
ON sites FOR DELETE
TO authenticated
USING (true);

-- Verify the policies were created
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'sites';
