-- ============================================
-- LEADS SCHEMA FOR SALES -> LEADS PAGE
-- ============================================
-- Quo-style calling list for lead management
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT,
  person_name TEXT,
  title TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  source TEXT CHECK (source IN ('glsa', 'coldlist', 'referral', 'web', 'other')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'dm_reached', 'walkthrough_booked', 'quote_pending', 'unqualified', 'do_not_contact')),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  last_touch_at TIMESTAMPTZ,
  next_action_at TIMESTAMPTZ,
  attempts_count INTEGER DEFAULT 0,
  notes_lite TEXT, -- Short notes, not full CRM timeline
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL, -- Link if converted
  contact_id UUID REFERENCES account_contacts(id) ON DELETE SET NULL, -- Link if converted
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL, -- Link if converted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure required columns exist (if table already existed from route management schema)
DO $$
BEGIN
  -- Add owner_user_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'owner_user_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  
  -- Add company_name if it doesn't exist (route management uses first_name/last_name)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE leads ADD COLUMN company_name TEXT;
  END IF;
  
  -- Add person_name if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'person_name'
  ) THEN
    ALTER TABLE leads ADD COLUMN person_name TEXT;
  END IF;
  
  -- Add title if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'title'
  ) THEN
    ALTER TABLE leads ADD COLUMN title TEXT;
  END IF;
  
  -- Add priority if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'priority'
  ) THEN
    ALTER TABLE leads ADD COLUMN priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5);
  END IF;
  
  -- Add last_touch_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'last_touch_at'
  ) THEN
    ALTER TABLE leads ADD COLUMN last_touch_at TIMESTAMPTZ;
  END IF;
  
  -- Add next_action_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'next_action_at'
  ) THEN
    ALTER TABLE leads ADD COLUMN next_action_at TIMESTAMPTZ;
  END IF;
  
  -- Add attempts_count if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'attempts_count'
  ) THEN
    ALTER TABLE leads ADD COLUMN attempts_count INTEGER DEFAULT 0;
  END IF;
  
  -- Add notes_lite if it doesn't exist (route management has notes)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'notes_lite'
  ) THEN
    ALTER TABLE leads ADD COLUMN notes_lite TEXT;
  END IF;
  
  -- Add account_id if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'leads' AND column_name = 'account_id'
    ) THEN
      ALTER TABLE leads ADD COLUMN account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
    END IF;
  END IF;
  
  -- Add contact_id if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'account_contacts') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'leads' AND column_name = 'contact_id'
    ) THEN
      ALTER TABLE leads ADD COLUMN contact_id UUID REFERENCES account_contacts(id) ON DELETE SET NULL;
    END IF;
  END IF;
  
  -- Add deal_id if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deals') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'leads' AND column_name = 'deal_id'
    ) THEN
      ALTER TABLE leads ADD COLUMN deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;
    END IF;
  END IF;
  
  -- Update status constraint if needed (route management has different statuses)
  -- We'll allow both sets of statuses by not enforcing a strict constraint if table exists
END $$;

-- Lead Activities table (call/outcome logs)
CREATE TABLE IF NOT EXISTS lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('call', 'sms', 'email', 'note', 'status_change')),
  outcome TEXT CHECK (outcome IN ('no_answer', 'gatekeeper', 'dm_reached', 'callback_set', 'not_interested', 'wrong_number', 'booked_walkthrough', 'do_not_contact')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  duration_seconds INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead Queues table (saved views/filters)
CREATE TABLE IF NOT EXISTS lead_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL for shared/team queues
  filter_definition JSONB DEFAULT '{}',
  sort_definition JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance (conditional - only create if columns exist)
DO $$
BEGIN
  -- Index on owner_user_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'owner_user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_leads_owner_user_id ON leads(owner_user_id);
  END IF;
  
  -- Index on status
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  END IF;
  
  -- Index on source
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'source') THEN
    CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
  END IF;
  
  -- Index on next_action_at
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'next_action_at') THEN
    CREATE INDEX IF NOT EXISTS idx_leads_next_action_at ON leads(next_action_at);
  END IF;
  
  -- Index on last_touch_at
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'last_touch_at') THEN
    CREATE INDEX IF NOT EXISTS idx_leads_last_touch_at ON leads(last_touch_at);
  END IF;
  
  -- Index on priority
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'priority') THEN
    CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
  END IF;
  
  -- Index on account_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'account_id') THEN
    CREATE INDEX IF NOT EXISTS idx_leads_account_id ON leads(account_id);
  END IF;
  
  -- Index on contact_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'contact_id') THEN
    CREATE INDEX IF NOT EXISTS idx_leads_contact_id ON leads(contact_id);
  END IF;
  
  -- Index on deal_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'deal_id') THEN
    CREATE INDEX IF NOT EXISTS idx_leads_deal_id ON leads(deal_id);
  END IF;
  
  -- Index on phone
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'phone') THEN
    CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone) WHERE phone IS NOT NULL;
  END IF;
  
  -- Index on email
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'email') THEN
    CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email) WHERE email IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_timestamp ON lead_activities(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_lead_activities_type ON lead_activities(type);

CREATE INDEX IF NOT EXISTS idx_lead_queues_owner_user_id ON lead_queues(owner_user_id);

-- Enable Row Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_queues ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leads
-- Reps can view their own leads, managers can view all
DROP POLICY IF EXISTS "Reps can view their leads" ON leads;
CREATE POLICY "Reps can view their leads" ON leads
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

DROP POLICY IF EXISTS "Reps can create leads" ON leads;
CREATE POLICY "Reps can create leads" ON leads
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

DROP POLICY IF EXISTS "Reps can update their leads" ON leads;
CREATE POLICY "Reps can update their leads" ON leads
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

DROP POLICY IF EXISTS "Managers can delete leads" ON leads;
CREATE POLICY "Managers can delete leads" ON leads
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'manager')
    )
  );

-- RLS Policies for lead_activities
DROP POLICY IF EXISTS "Users can view activities for accessible leads" ON lead_activities;
CREATE POLICY "Users can view activities for accessible leads" ON lead_activities
  FOR SELECT USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = lead_activities.lead_id
      AND (
        leads.owner_user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'manager', 'client')
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can create activities for accessible leads" ON lead_activities;
CREATE POLICY "Users can create activities for accessible leads" ON lead_activities
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = lead_activities.lead_id
      AND (
        leads.owner_user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'manager')
        )
      )
    )
  );

-- RLS Policies for lead_queues
DROP POLICY IF EXISTS "Users can view their queues" ON lead_queues;
CREATE POLICY "Users can view their queues" ON lead_queues
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      owner_user_id = auth.uid() OR
      owner_user_id IS NULL OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'manager')
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage their queues" ON lead_queues;
CREATE POLICY "Users can manage their queues" ON lead_queues
  FOR ALL USING (
    auth.role() = 'authenticated' AND (
      owner_user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'manager')
      )
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_leads_updated_at ON leads;
CREATE TRIGGER trigger_update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_updated_at();

CREATE OR REPLACE FUNCTION update_lead_queues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_lead_queues_updated_at ON lead_queues;
CREATE TRIGGER trigger_update_lead_queues_updated_at
  BEFORE UPDATE ON lead_queues
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_queues_updated_at();

-- Grant permissions
GRANT ALL ON leads TO authenticated;
GRANT ALL ON lead_activities TO authenticated;
GRANT ALL ON lead_queues TO authenticated;

SELECT '✅ Leads Schema Ready!' as result;
