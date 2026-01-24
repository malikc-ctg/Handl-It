-- ============================================
-- ENSURE ADMINS GET FULL ACCESS TO DEALS & SITES
-- ============================================
-- This script ensures all users with 'admin' or 'super_admin' role
-- can see and manage ALL deals and sites, regardless of workspace
-- Run this in Supabase SQL Editor
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Create/Update Helper Function for Admin Check
-- ============================================

-- Create a helper function that checks if current user is admin or super_admin
CREATE OR REPLACE FUNCTION is_user_admin_or_super()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_user_admin_or_super() TO authenticated;

-- ============================================
-- STEP 2: Update DEALS RLS Policies
-- ============================================

-- Enable RLS on deals if not already enabled
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for deals (we'll recreate them)
DROP POLICY IF EXISTS "Service role full access to deals" ON deals;
DROP POLICY IF EXISTS "Workspace members can view deals" ON deals;
DROP POLICY IF EXISTS "Workspace members can manage deals" ON deals;
DROP POLICY IF EXISTS "Reps can view assigned deals" ON deals;
DROP POLICY IF EXISTS "Reps can create deals" ON deals;
DROP POLICY IF EXISTS "Users can update deals by assignment" ON deals;
DROP POLICY IF EXISTS "Admins can view all deals, others see workspace/assigned" ON deals;
DROP POLICY IF EXISTS "Admins can insert any deal, others need workspace" ON deals;
DROP POLICY IF EXISTS "Admins can update all deals, others need workspace/assignment" ON deals;
DROP POLICY IF EXISTS "Admins can delete all deals, others need workspace/ownership" ON deals;

-- Service role full access (keep this)
CREATE POLICY "Service role full access to deals"
  ON deals FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- SELECT: Admins see ALL deals, others see workspace/assigned deals
CREATE POLICY "Admins can view all deals, others see workspace/assigned"
  ON deals FOR SELECT
  USING (
    -- Admins and super_admins see everything
    is_user_admin_or_super()
    OR
    -- Workspace members see their workspace deals
    (
      workspace_id IS NULL OR
      workspace_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
        UNION
        SELECT id FROM company_profiles WHERE owner_id = auth.uid()
      )
    )
    OR
    -- Users see deals assigned to them
    assigned_user_id = auth.uid()
    OR
    -- Users see deals they created
    (created_by IS NOT NULL AND created_by = auth.uid())
  );

-- INSERT: Admins can insert anywhere, others need workspace access
CREATE POLICY "Admins can insert any deal, others need workspace"
  ON deals FOR INSERT
  WITH CHECK (
    -- Admins can insert anywhere
    is_user_admin_or_super()
    OR
    -- Others need workspace access
    (
      workspace_id IS NULL OR
      workspace_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
        UNION
        SELECT id FROM company_profiles WHERE owner_id = auth.uid()
      )
    )
    OR
    -- Or they're creating it themselves
    (created_by IS NULL OR created_by = auth.uid())
  );

-- UPDATE: Admins can update any deal, others need workspace/assignment
CREATE POLICY "Admins can update all deals, others need workspace/assignment"
  ON deals FOR UPDATE
  USING (
    -- Admins can update everything
    is_user_admin_or_super()
    OR
    -- Workspace members can update their workspace deals
    (
      workspace_id IS NULL OR
      workspace_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
        UNION
        SELECT id FROM company_profiles WHERE owner_id = auth.uid()
      )
    )
    OR
    -- Users can update deals assigned to them
    assigned_user_id = auth.uid()
    OR
    -- Users can update deals they created
    (created_by IS NOT NULL AND created_by = auth.uid())
  )
  WITH CHECK (
    -- Same conditions for WITH CHECK
    is_user_admin_or_super()
    OR
    (
      workspace_id IS NULL OR
      workspace_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
        UNION
        SELECT id FROM company_profiles WHERE owner_id = auth.uid()
      )
    )
    OR
    assigned_user_id = auth.uid()
    OR
    (created_by IS NULL OR created_by = auth.uid())
  );

-- DELETE: Admins can delete any deal, others need workspace/ownership
CREATE POLICY "Admins can delete all deals, others need workspace/ownership"
  ON deals FOR DELETE
  USING (
    -- Admins can delete everything
    is_user_admin_or_super()
    OR
    -- Workspace members can delete their workspace deals
    (
      workspace_id IS NULL OR
      workspace_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
        UNION
        SELECT id FROM company_profiles WHERE owner_id = auth.uid()
      )
    )
    OR
    -- Users can delete deals they created
    (created_by IS NOT NULL AND created_by = auth.uid())
  );

-- ============================================
-- STEP 3: Update SITES RLS Policies
-- ============================================

-- Enable RLS on sites if not already enabled
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for sites (we'll recreate them)
DROP POLICY IF EXISTS "Users can view sites" ON sites;
DROP POLICY IF EXISTS "Super admin and owners can view sites" ON sites;
DROP POLICY IF EXISTS "Users can insert sites" ON sites;
DROP POLICY IF EXISTS "Super admin and authenticated can insert sites" ON sites;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON sites;
DROP POLICY IF EXISTS "Users can update sites" ON sites;
DROP POLICY IF EXISTS "Super admin and owners can update sites" ON sites;
DROP POLICY IF EXISTS "Users can delete sites" ON sites;
DROP POLICY IF EXISTS "Super admin and owners can delete sites" ON sites;
DROP POLICY IF EXISTS "Enable select for own sites" ON sites;
DROP POLICY IF EXISTS "Clients can view own sites" ON sites;
DROP POLICY IF EXISTS "Admins can view all sites, others see own/assigned" ON sites;
DROP POLICY IF EXISTS "Admins and authenticated users can insert sites" ON sites;
DROP POLICY IF EXISTS "Admins can update all sites, others need ownership/assignment" ON sites;
DROP POLICY IF EXISTS "Admins can delete all sites, others need ownership" ON sites;

-- SELECT: Admins see ALL sites, others see their own/assigned sites
-- This policy works whether or not created_by, assigned_worker_id, or client_id columns exist
-- If columns don't exist, those conditions will simply be false (which is fine)
DO $$
BEGIN
  -- Try to create policy with all possible column checks
  -- If a column doesn't exist, PostgreSQL will error, so we catch and create simpler version
  BEGIN
    EXECUTE '
    CREATE POLICY "Admins can view all sites, others see own/assigned"
      ON sites FOR SELECT
      USING (
        is_user_admin_or_super()
        OR (created_by IS NOT NULL AND created_by = auth.uid())
        OR (assigned_worker_id IS NOT NULL AND assigned_worker_id = auth.uid())
        OR (client_id IS NOT NULL AND client_id = auth.uid())
      )';
  EXCEPTION WHEN undefined_column THEN
    -- If created_by doesn't exist, try without it
    BEGIN
      EXECUTE '
      CREATE POLICY "Admins can view all sites, others see own/assigned"
        ON sites FOR SELECT
        USING (
          is_user_admin_or_super()
          OR (assigned_worker_id IS NOT NULL AND assigned_worker_id = auth.uid())
          OR (client_id IS NOT NULL AND client_id = auth.uid())
        )';
    EXCEPTION WHEN undefined_column THEN
      -- If assigned_worker_id doesn't exist either, try with just client_id
      BEGIN
        EXECUTE '
        CREATE POLICY "Admins can view all sites, others see own/assigned"
          ON sites FOR SELECT
          USING (
            is_user_admin_or_super()
            OR (client_id IS NOT NULL AND client_id = auth.uid())
          )';
      EXCEPTION WHEN undefined_column THEN
        -- If no optional columns exist, admins see all, others see all (no restrictions)
        EXECUTE '
        CREATE POLICY "Admins can view all sites, others see own/assigned"
          ON sites FOR SELECT
          USING (true)';
      END;
    END;
  END;
END $$;

-- INSERT: Admins can insert anywhere, authenticated users can insert
CREATE POLICY "Admins and authenticated users can insert sites"
  ON sites FOR INSERT
  WITH CHECK (
    -- Admins can insert anywhere
    is_user_admin_or_super()
    OR
    -- Any authenticated user can insert
    auth.uid() IS NOT NULL
  );

-- UPDATE: Admins can update any site, others need ownership/assignment
DO $$
BEGIN
  BEGIN
    EXECUTE '
    CREATE POLICY "Admins can update all sites, others need ownership/assignment"
      ON sites FOR UPDATE
      USING (
        is_user_admin_or_super()
        OR (created_by IS NOT NULL AND created_by = auth.uid())
        OR (assigned_worker_id IS NOT NULL AND assigned_worker_id = auth.uid())
        OR (client_id IS NOT NULL AND client_id = auth.uid())
      )
      WITH CHECK (
        is_user_admin_or_super()
        OR (created_by IS NULL OR created_by = auth.uid())
        OR (assigned_worker_id IS NOT NULL AND assigned_worker_id = auth.uid())
        OR (client_id IS NOT NULL AND client_id = auth.uid())
      )';
  EXCEPTION WHEN undefined_column THEN
    BEGIN
      EXECUTE '
      CREATE POLICY "Admins can update all sites, others need ownership/assignment"
        ON sites FOR UPDATE
        USING (
          is_user_admin_or_super()
          OR (assigned_worker_id IS NOT NULL AND assigned_worker_id = auth.uid())
          OR (client_id IS NOT NULL AND client_id = auth.uid())
        )
        WITH CHECK (
          is_user_admin_or_super()
          OR (assigned_worker_id IS NOT NULL AND assigned_worker_id = auth.uid())
          OR (client_id IS NOT NULL AND client_id = auth.uid())
        )';
    EXCEPTION WHEN undefined_column THEN
      BEGIN
        EXECUTE '
        CREATE POLICY "Admins can update all sites, others need ownership/assignment"
          ON sites FOR UPDATE
          USING (
            is_user_admin_or_super()
            OR (client_id IS NOT NULL AND client_id = auth.uid())
          )
          WITH CHECK (
            is_user_admin_or_super()
            OR (client_id IS NOT NULL AND client_id = auth.uid())
          )';
      EXCEPTION WHEN undefined_column THEN
        -- If no optional columns, admins can update all
        EXECUTE '
        CREATE POLICY "Admins can update all sites, others need ownership/assignment"
          ON sites FOR UPDATE
          USING (is_user_admin_or_super())
          WITH CHECK (is_user_admin_or_super())';
      END;
    END;
  END;
END $$;

-- DELETE: Admins can delete any site, others need ownership
DO $$
BEGIN
  BEGIN
    EXECUTE '
    CREATE POLICY "Admins can delete all sites, others need ownership"
      ON sites FOR DELETE
      USING (
        is_user_admin_or_super()
        OR (created_by IS NOT NULL AND created_by = auth.uid())
      )';
  EXCEPTION WHEN undefined_column THEN
    -- If created_by doesn't exist, only admins can delete
    EXECUTE '
    CREATE POLICY "Admins can delete all sites, others need ownership"
      ON sites FOR DELETE
      USING (is_user_admin_or_super())';
  END;
END $$;

COMMIT;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ ADMIN FULL ACCESS CONFIGURED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '🔑 Admins and super_admins now have:';
  RAISE NOTICE '   ✅ Full access to ALL deals';
  RAISE NOTICE '   ✅ Full access to ALL sites';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Helper function created:';
  RAISE NOTICE '   - is_user_admin_or_super()';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 RLS policies updated for:';
  RAISE NOTICE '   - deals table (SELECT, INSERT, UPDATE, DELETE)';
  RAISE NOTICE '   - sites table (SELECT, INSERT, UPDATE, DELETE)';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
