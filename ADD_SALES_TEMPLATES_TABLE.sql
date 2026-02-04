-- ============================================
-- Sales Templates Table (company-scoped)
-- ============================================
-- Follow-up and proposal email/document templates with merge fields.
-- Run in Supabase SQL Editor after CORE_SALES_CRM or equivalent.
-- For multi-tenant: ensure user_profiles has a company_id column, or the RLS
-- policy below may need to use auth.uid() only (single-tenant per user).
-- ============================================

-- Optional: ensure company_profiles or equivalent exists; if your app uses user.id as company_id, no FK needed.
-- Here we use company_id UUID nullable so it works with or without a companies table.
CREATE TABLE IF NOT EXISTS sales_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID, -- multi-tenant: restrict to user's company
  template_type TEXT NOT NULL CHECK (template_type IN ('follow_up', 'proposal')),
  name TEXT NOT NULL,
  subject TEXT, -- for email; null for document-only
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb, -- e.g. ["contact_name", "company_name", "site_name", "deal_value"]
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_templates_company ON sales_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_templates_type ON sales_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_sales_templates_active ON sales_templates(is_active);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_sales_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sales_templates_updated_at ON sales_templates;
CREATE TRIGGER trigger_sales_templates_updated_at
  BEFORE UPDATE ON sales_templates
  FOR EACH ROW EXECUTE FUNCTION update_sales_templates_updated_at();

COMMENT ON TABLE sales_templates IS 'Company-scoped templates for follow-up emails and proposals; supports merge fields like {contact_name}, {company_name}, {site_name}, {deal_value}.';

-- Grant required for authenticated role (avoids 403 / permission denied)
GRANT ALL ON sales_templates TO authenticated;

-- RLS: users see only their own rows (company_id = auth.uid()) or shared (company_id IS NULL)
ALTER TABLE sales_templates ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access to sales_templates"
  ON sales_templates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated: manage rows where company_id IS NULL or company_id = auth.uid() (no dependency on user_profiles.company_id)
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
