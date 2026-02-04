-- ============================================
-- FIX: Company-Wide Expense Visibility
-- ============================================
-- Expenses entered by one user (e.g. Ayaan) were not visible to other
-- users (e.g. Malik) in the same company. This updates RLS so all
-- company members can view all company expenses.
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view expenses for their jobs or sites" ON expenses;

-- Recreate with company-wide visibility:
-- 1. Admins see all expenses
-- 2. Users see their own expenses
-- 3. Users see expenses from anyone in their company (same company_id)
-- 4. Users see expenses for jobs/sites they have access to
CREATE POLICY "Users can view company and relevant expenses" ON expenses
  FOR SELECT USING (
    -- Admins see everything (if helper exists)
    (EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ))
    OR
    -- Own expenses
    created_by = auth.uid()
    OR
    -- Same company: expense creator is in your company
    (
      created_by IS NOT NULL
      AND created_by IN (
        SELECT id FROM user_profiles
        WHERE company_id IS NOT NULL
        AND company_id = (
          SELECT company_id FROM user_profiles WHERE id = auth.uid() LIMIT 1
        )
      )
    )
    OR
    -- Job access: expense linked to a job you created or are client for
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = expenses.job_id
      AND (jobs.created_by = auth.uid() OR jobs.client_id = auth.uid())
    )
    OR
    -- Site access: expense linked to a site you created
    EXISTS (
      SELECT 1 FROM sites
      WHERE sites.id = expenses.site_id
      AND sites.created_by = auth.uid()
    )
  );

-- Ensure INSERT allows any company member to add expenses (keep created_by check)
-- Drop and recreate if we need to relax INSERT
DROP POLICY IF EXISTS "Users can create expenses" ON expenses;
CREATE POLICY "Users can create expenses" ON expenses
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
  );

-- Update: allow company members to update any company expense (not just own)
DROP POLICY IF EXISTS "Users can update expenses they created" ON expenses;
CREATE POLICY "Company members can update expenses" ON expenses
  FOR UPDATE USING (
    created_by = auth.uid()
    OR (
      created_by IS NOT NULL
      AND created_by IN (
        SELECT id FROM user_profiles
        WHERE company_id IS NOT NULL
        AND company_id = (
          SELECT company_id FROM user_profiles WHERE id = auth.uid() LIMIT 1
        )
      )
    )
  );

-- Delete: allow company members to delete company expenses
DROP POLICY IF EXISTS "Users can delete expenses they created" ON expenses;
CREATE POLICY "Company members can delete expenses" ON expenses
  FOR DELETE USING (
    created_by = auth.uid()
    OR (
      created_by IS NOT NULL
      AND created_by IN (
        SELECT id FROM user_profiles
        WHERE company_id IS NOT NULL
        AND company_id = (
          SELECT company_id FROM user_profiles WHERE id = auth.uid() LIMIT 1
        )
      )
    )
  );

SELECT 'Expenses RLS updated - company-wide visibility enabled' AS status;

-- Verify: Check that Ayaan and Malik (and all staff) have company_id set
-- If company_id is NULL, run LINK_USER_TO_COMPANY.sql or similar to link users to your company
-- SELECT id, email, full_name, company_id FROM user_profiles;
