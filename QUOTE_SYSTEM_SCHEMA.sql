-- ============================================
-- Quote System Schema - Complete Implementation
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- A) quotes (parent table)
-- Drop existing quotes table if it exists from old schema (optional - comment out if you want to keep old data)
-- DROP TABLE IF EXISTS quotes CASCADE;

CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id BIGINT REFERENCES sites(id) ON DELETE SET NULL, -- Using sites as accounts
  primary_contact_id UUID, -- Can reference user_profiles or contacts
  deal_id UUID, -- References deals table (nullable but recommended)
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'withdrawn')),
  quote_type TEXT NOT NULL DEFAULT 'walkthrough_required' CHECK (quote_type IN ('standard', 'walkthrough_required', 'ballpark')),
  active_revision_number INTEGER DEFAULT 1,
  currency TEXT DEFAULT 'CAD',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add columns if table already exists (for migration from old schema)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quotes') THEN
    -- Add new columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'account_id') THEN
      ALTER TABLE quotes ADD COLUMN account_id BIGINT REFERENCES sites(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'primary_contact_id') THEN
      ALTER TABLE quotes ADD COLUMN primary_contact_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'deal_id') THEN
      ALTER TABLE quotes ADD COLUMN deal_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'owner_user_id') THEN
      ALTER TABLE quotes ADD COLUMN owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'quote_type') THEN
      ALTER TABLE quotes ADD COLUMN quote_type TEXT DEFAULT 'walkthrough_required';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'active_revision_number') THEN
      ALTER TABLE quotes ADD COLUMN active_revision_number INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'currency') THEN
      ALTER TABLE quotes ADD COLUMN currency TEXT DEFAULT 'CAD';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'updated_at') THEN
      ALTER TABLE quotes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
  END IF;
END $$;

-- B) quote_revisions (immutable snapshot once sent)
CREATE TABLE IF NOT EXISTS quote_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  revision_number INTEGER NOT NULL,
  revision_type TEXT NOT NULL CHECK (revision_type IN ('walkthrough_proposal', 'final_quote')),
  status_at_send TEXT, -- Status when this revision was sent
  subtotal NUMERIC(12,2),
  tax NUMERIC(12,2),
  total NUMERIC(12,2),
  is_binding BOOLEAN NOT NULL DEFAULT false,
  billing_frequency TEXT CHECK (billing_frequency IN ('monthly', 'weekly', 'biweekly', 'one_time')),
  contract_term_months INTEGER,
  start_date_proposed DATE,
  service_schedule_summary TEXT,
  scope_summary TEXT,
  assumptions TEXT,
  exclusions TEXT,
  internal_notes TEXT, -- Never shown in portal
  sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  sent_to_emails TEXT[], -- Array of email addresses
  public_token TEXT UNIQUE, -- Secure random unique token for portal access
  pdf_url TEXT,
  accepted_at TIMESTAMPTZ,
  accepted_by_name TEXT,
  accepted_by_email TEXT,
  accepted_ip TEXT,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  decline_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(quote_id, revision_number)
);

-- C) quote_line_items
CREATE TABLE IF NOT EXISTS quote_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  revision_number INTEGER NOT NULL,
  category TEXT,
  name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit TEXT NOT NULL CHECK (unit IN ('flat', 'sqft', 'unit', 'visit', 'hour', 'range')),
  unit_price NUMERIC(12,2), -- Nullable for range
  range_low NUMERIC(12,2), -- Nullable, used when unit = 'range'
  range_high NUMERIC(12,2), -- Nullable, used when unit = 'range'
  frequency_multiplier NUMERIC(10,2) DEFAULT 1,
  line_total NUMERIC(12,2),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(quote_id, revision_number, display_order)
);

-- D) quote_events (audit trail)
CREATE TABLE IF NOT EXISTS quote_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  revision_number INTEGER,
  event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'viewed', 'pdf_downloaded', 'accepted', 'declined', 'expired', 'withdrawn', 'walkthrough_scheduled', 'walkthrough_rescheduled', 'walkthrough_completed', 'walkthrough_no_show', 'revision_created')),
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  metadata JSONB, -- Flexible metadata storage
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- E) quote_walkthroughs (linked to quote)
CREATE TABLE IF NOT EXISTS quote_walkthroughs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  account_id BIGINT REFERENCES sites(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'no_show', 'rescheduled', 'cancelled')),
  location_address TEXT,
  notes TEXT,
  photos TEXT[], -- Array of photo URLs
  measured_inputs JSONB, -- Flexible storage: {sqft, floors, washrooms, kitchens, units, specialAreas, frequencyPreference}
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance (only create if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'owner_user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_quotes_owner_user_id ON quotes(owner_user_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'deal_id') THEN
    CREATE INDEX IF NOT EXISTS idx_quotes_deal_id ON quotes(deal_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'account_id') THEN
    CREATE INDEX IF NOT EXISTS idx_quotes_account_id ON quotes(account_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'quote_type') THEN
    CREATE INDEX IF NOT EXISTS idx_quotes_quote_type ON quotes(quote_type);
  END IF;
END $$;

-- Create indexes for new tables (these should always exist if tables are created fresh)
-- Wrap in DO blocks to check column existence for safety
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quote_revisions') THEN
    CREATE INDEX IF NOT EXISTS idx_quote_revisions_quote_id ON quote_revisions(quote_id);
    CREATE INDEX IF NOT EXISTS idx_quote_revisions_public_token ON quote_revisions(public_token);
    CREATE INDEX IF NOT EXISTS idx_quote_revisions_revision_type ON quote_revisions(revision_type);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quote_line_items') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'revision_number') THEN
      CREATE INDEX IF NOT EXISTS idx_quote_line_items_quote_revision ON quote_line_items(quote_id, revision_number);
    END IF;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quote_events') THEN
    CREATE INDEX IF NOT EXISTS idx_quote_events_quote_id ON quote_events(quote_id);
    CREATE INDEX IF NOT EXISTS idx_quote_events_timestamp ON quote_events(timestamp);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quote_walkthroughs') THEN
    CREATE INDEX IF NOT EXISTS idx_quote_walkthroughs_quote_id ON quote_walkthroughs(quote_id);
    CREATE INDEX IF NOT EXISTS idx_quote_walkthroughs_status ON quote_walkthroughs(status);
  END IF;
END $$;

-- RLS Policies (allowing authenticated users for now - can be tightened later)
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_walkthroughs ENABLE ROW LEVEL SECURITY;

-- Basic policies (allow all for authenticated users - can be customized per role)
CREATE POLICY "Allow all for authenticated users" ON quotes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON quote_revisions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON quote_line_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON quote_events FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON quote_walkthroughs FOR ALL USING (auth.role() = 'authenticated');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quote_walkthroughs_updated_at BEFORE UPDATE ON quote_walkthroughs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON quotes TO authenticated, anon;
GRANT ALL ON quote_revisions TO authenticated, anon;
GRANT ALL ON quote_line_items TO authenticated, anon;
GRANT ALL ON quote_events TO authenticated, anon;
GRANT ALL ON quote_walkthroughs TO authenticated, anon;

SELECT '✅ Quote system schema created successfully!' as result;
