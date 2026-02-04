-- ============================================
-- Fix: permission denied for table sales_templates (403 / 42501)
-- ============================================
-- Run this in Supabase SQL Editor after ADD_SALES_TEMPLATES_TABLE.sql.
-- 1. Grants authenticated role access to the table.
-- 2. Replaces RLS policy so it works even when user_profiles has no company_id.
-- ============================================

-- 1. Grant table access to authenticated (required for Supabase anon key)
GRANT ALL ON sales_templates TO authenticated;

-- 2. Drop the existing policy that may reference user_profiles.company_id
DROP POLICY IF EXISTS "Users can manage own company sales_templates" ON sales_templates;

-- 3. New policy: users can manage rows where company_id is their auth.uid() or NULL (shared).
--    No dependency on user_profiles.company_id, so it works even if that column is missing.
CREATE POLICY "Users can manage own company sales_templates"
  ON sales_templates FOR ALL
  TO authenticated
  USING (
    company_id IS NULL
    OR company_id = auth.uid()
  )
  WITH CHECK (
    company_id IS NULL
    OR company_id = auth.uid()
  );
