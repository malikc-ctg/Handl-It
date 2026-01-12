-- ============================================
-- ACCOUNTS DIRECTORY SCHEMA
-- ============================================
-- Client Accounts Directory for Sales -> Contacts page
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Accounts table (companies/clients)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- Company name
  status TEXT NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'in_progress', 'active', 'dormant')),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Rep/owner
  dm_contact_id UUID, -- References account_contacts(id), set via trigger
  hq_address TEXT,
  city TEXT,
  site_count INTEGER DEFAULT 0, -- Denormalized count
  contact_count INTEGER DEFAULT 0, -- Denormalized count
  last_touch_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Account Contacts (contacts linked to accounts)
CREATE TABLE IF NOT EXISTS account_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  title TEXT,
  phone TEXT,
  email TEXT,
  role_tag TEXT DEFAULT 'other' CHECK (role_tag IN ('decision_maker', 'admin', 'facilities', 'billing', 'other')),
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Account Sites (sites linked to accounts)
CREATE TABLE IF NOT EXISTS account_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT, -- Optional: "Site 1", building name
  address TEXT NOT NULL,
  city TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraint for dm_contact_id after account_contacts table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'accounts_dm_contact_id_fkey'
  ) THEN
    ALTER TABLE accounts
    ADD CONSTRAINT accounts_dm_contact_id_fkey
    FOREIGN KEY (dm_contact_id) REFERENCES account_contacts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_accounts_owner_user_id ON accounts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_name ON accounts(name);
CREATE INDEX IF NOT EXISTS idx_accounts_last_touch_at ON accounts(last_touch_at);
CREATE INDEX IF NOT EXISTS idx_account_contacts_account_id ON account_contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_account_contacts_role_tag ON account_contacts(role_tag);
CREATE INDEX IF NOT EXISTS idx_account_sites_account_id ON account_sites(account_id);

-- Enable Row Level Security
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_sites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for accounts
DROP POLICY IF EXISTS "Reps can view their accounts" ON accounts;
CREATE POLICY "Reps can view their accounts" ON accounts
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      owner_user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'manager', 'client')
      )
    )
  );

DROP POLICY IF EXISTS "Reps can create accounts" ON accounts;
CREATE POLICY "Reps can create accounts" ON accounts
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND (
      owner_user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'manager')
      )
    )
  );

DROP POLICY IF EXISTS "Reps can update their accounts" ON accounts;
CREATE POLICY "Reps can update their accounts" ON accounts
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      owner_user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'manager')
      )
    )
  );

DROP POLICY IF EXISTS "Managers can delete accounts" ON accounts;
CREATE POLICY "Managers can delete accounts" ON accounts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'manager')
    )
  );

-- RLS Policies for account_contacts
DROP POLICY IF EXISTS "Users can view contacts for accessible accounts" ON account_contacts;
CREATE POLICY "Users can view contacts for accessible accounts" ON account_contacts
  FOR SELECT USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = account_contacts.account_id
      AND (
        accounts.owner_user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'manager', 'client')
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage contacts for accessible accounts" ON account_contacts;
CREATE POLICY "Users can manage contacts for accessible accounts" ON account_contacts
  FOR ALL USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = account_contacts.account_id
      AND (
        accounts.owner_user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'manager')
        )
      )
    )
  );

-- RLS Policies for account_sites
DROP POLICY IF EXISTS "Users can view sites for accessible accounts" ON account_sites;
CREATE POLICY "Users can view sites for accessible accounts" ON account_sites
  FOR SELECT USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = account_sites.account_id
      AND (
        accounts.owner_user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'manager', 'client')
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage sites for accessible accounts" ON account_sites;
CREATE POLICY "Users can manage sites for accessible accounts" ON account_sites
  FOR ALL USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = account_sites.account_id
      AND (
        accounts.owner_user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'manager')
        )
      )
    )
  );

-- Function to update account counts
CREATE OR REPLACE FUNCTION update_account_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'account_contacts' THEN
      UPDATE accounts SET contact_count = contact_count + 1 WHERE id = NEW.account_id;
    ELSIF TG_TABLE_NAME = 'account_sites' THEN
      UPDATE accounts SET site_count = site_count + 1 WHERE id = NEW.account_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'account_contacts' THEN
      UPDATE accounts SET contact_count = GREATEST(0, contact_count - 1) WHERE id = OLD.account_id;
      -- If deleted contact was DM, clear dm_contact_id
      UPDATE accounts SET dm_contact_id = NULL WHERE dm_contact_id = OLD.id;
    ELSIF TG_TABLE_NAME = 'account_sites' THEN
      UPDATE accounts SET site_count = GREATEST(0, site_count - 1) WHERE id = OLD.account_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update counts
DROP TRIGGER IF EXISTS trigger_update_account_counts_contacts ON account_contacts;
CREATE TRIGGER trigger_update_account_counts_contacts
  AFTER INSERT OR DELETE ON account_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_account_counts();

DROP TRIGGER IF EXISTS trigger_update_account_counts_sites ON account_sites;
CREATE TRIGGER trigger_update_account_counts_sites
  AFTER INSERT OR DELETE ON account_sites
  FOR EACH ROW
  EXECUTE FUNCTION update_account_counts();

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_accounts_updated_at ON accounts;
CREATE TRIGGER trigger_update_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_accounts_updated_at();

CREATE OR REPLACE FUNCTION update_account_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_account_contacts_updated_at ON account_contacts;
CREATE TRIGGER trigger_update_account_contacts_updated_at
  BEFORE UPDATE ON account_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_account_contacts_updated_at();

CREATE OR REPLACE FUNCTION update_account_sites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_account_sites_updated_at ON account_sites;
CREATE TRIGGER trigger_update_account_sites_updated_at
  BEFORE UPDATE ON account_sites
  FOR EACH ROW
  EXECUTE FUNCTION update_account_sites_updated_at();

-- Grant permissions
GRANT ALL ON accounts TO authenticated;
GRANT ALL ON account_contacts TO authenticated;
GRANT ALL ON account_sites TO authenticated;

SELECT '✅ Accounts Directory Schema Ready!' as result;
