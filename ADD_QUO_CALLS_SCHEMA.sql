-- ============================================
-- Quo Call Tracker Integration Schema
-- ============================================
-- Creates tables for call tracking, webhook storage,
-- and Quo contact mappings
-- 
-- EXECUTION ORDER:
-- 1. Run ADD_SALES_PORTAL_SCHEMA.sql first (creates deals, contacts tables)
-- 2. Then run this script (ADD_QUO_CALLS_SCHEMA.sql)
-- 3. If deals/contacts don't exist, foreign keys will fail - run ADD_SALES_PORTAL_SCHEMA.sql first
-- ============================================

-- Ensure we can generate UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- calls
-- Stores normalized call events from Quo
-- ============================================
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Quo identifiers (nullable for manual calls)
  quo_call_id TEXT UNIQUE, -- Provider event ID for idempotency (NULL for manual entries)
  quo_contact_id TEXT, -- Quo contact reference
  
  -- Call metadata
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  call_type TEXT CHECK (call_type IN ('inbound', 'outbound')), -- Alias for direction (sales portal compatibility)
  outcome TEXT NOT NULL CHECK (outcome IN ('answered', 'missed', 'voicemail', 'busy', 'failed', 'no_answer', 'cancelled')),
  status TEXT DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'answered', 'completed', 'failed')),
  
  -- Phone numbers (normalized to E.164)
  from_number TEXT NOT NULL, -- Normalized E.164 format
  to_number TEXT NOT NULL, -- Normalized E.164 format
  from_number_raw TEXT, -- Original format for display
  to_number_raw TEXT, -- Original format for display
  
  -- Timing
  started_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER, -- Calculated from started_at/ended_at
  
  -- Linking to leads/deals/sites (supports both sales portal and facility management)
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE, -- Sales portal: link to deal
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL, -- Sales portal: link to contact
  site_id BIGINT REFERENCES sites(id) ON DELETE SET NULL, -- Facility management: link to site
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- User who made/received the call
  linked_by TEXT DEFAULT 'phone_match' CHECK (linked_by IN ('phone_match', 'quo_contact', 'manual', 'internal_reference')),
  needs_review BOOLEAN DEFAULT FALSE, -- Set to true if multiple matches found
  
  -- Call content (consent-gated)
  has_consent BOOLEAN DEFAULT FALSE, -- REQUIRED: Consent must be obtained before storing transcripts/recordings
  transcript TEXT, -- Only stored if has_consent = true
  recording_url TEXT, -- Only stored if has_consent = true
  summary TEXT, -- AI-generated summary
  notes TEXT, -- General notes (not consent-gated)
  
  -- Post-call workflow
  objection_tags TEXT[], -- Array of objection tags extracted
  next_action_suggested TEXT, -- Suggested next action task
  next_action_created BOOLEAN DEFAULT FALSE, -- Whether task was auto-created
  
  -- Metadata
  raw_webhook_payload JSONB, -- Full webhook for debugging (with retention)
  metadata JSONB DEFAULT '{}', -- Additional metadata (sales portal compatibility)
  webhook_received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist (table may already exist from CORE_SALES_CRM_SCHEMA.sql)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calls') THEN
    -- Add site_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'site_id') THEN
      ALTER TABLE calls ADD COLUMN site_id BIGINT REFERENCES sites(id) ON DELETE SET NULL;
    END IF;
    
    -- Add contact_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'contact_id') THEN
      ALTER TABLE calls ADD COLUMN contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
    END IF;
    
    -- Add user_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'user_id') THEN
      ALTER TABLE calls ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    
    -- Add linked_by if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'linked_by') THEN
      ALTER TABLE calls ADD COLUMN linked_by TEXT DEFAULT 'phone_match';
    END IF;
    
    -- Add needs_review if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'needs_review') THEN
      ALTER TABLE calls ADD COLUMN needs_review BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add outcome if it doesn't exist (may be an enum in CORE_SALES_CRM_SCHEMA.sql)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'outcome') THEN
      -- Check if call_outcome enum exists
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_outcome') THEN
        ALTER TABLE calls ADD COLUMN outcome call_outcome;
      ELSE
        ALTER TABLE calls ADD COLUMN outcome TEXT;
      END IF;
    END IF;
    
    -- Add webhook_received_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'webhook_received_at') THEN
      ALTER TABLE calls ADD COLUMN webhook_received_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
  END IF;
END $$;

-- Ensure idempotency: quo_call_id must be unique when provided (prevents duplicate webhook processing)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'quo_call_id') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_quo_call_id_unique ON calls(quo_call_id) WHERE quo_call_id IS NOT NULL;
  END IF;
END $$;

-- Indexes for performance (conditional - check if columns exist)
DO $$
BEGIN
  -- Index on quo_call_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'quo_call_id') THEN
    CREATE INDEX IF NOT EXISTS idx_calls_quo_call_id ON calls(quo_call_id) WHERE quo_call_id IS NOT NULL;
  END IF;
  
  -- Index on from_number
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'from_number') THEN
    CREATE INDEX IF NOT EXISTS idx_calls_from_number ON calls(from_number);
  END IF;
  
  -- Index on to_number
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'to_number') THEN
    CREATE INDEX IF NOT EXISTS idx_calls_to_number ON calls(to_number);
  END IF;
  
  -- Index on site_id (if column exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'site_id') THEN
    CREATE INDEX IF NOT EXISTS idx_calls_site_id ON calls(site_id) WHERE site_id IS NOT NULL;
  END IF;
  
  -- Index on deal_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'deal_id') THEN
    CREATE INDEX IF NOT EXISTS idx_calls_deal_id ON calls(deal_id) WHERE deal_id IS NOT NULL;
  END IF;
  
  -- Index on contact_id (if column exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'contact_id') THEN
    CREATE INDEX IF NOT EXISTS idx_calls_contact_id ON calls(contact_id) WHERE contact_id IS NOT NULL;
  END IF;
  
  -- Index on user_id (if column exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_calls_user_id ON calls(user_id) WHERE user_id IS NOT NULL;
  END IF;
  
  -- Index on started_at
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'started_at') THEN
    CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at);
  END IF;
  
  -- Index on outcome
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'outcome') THEN
    CREATE INDEX IF NOT EXISTS idx_calls_outcome ON calls(outcome);
  END IF;
  
  -- Index on needs_review
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'needs_review') THEN
    CREATE INDEX IF NOT EXISTS idx_calls_needs_review ON calls(needs_review) WHERE needs_review = TRUE;
  END IF;
  
  -- Index on webhook_received_at
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'webhook_received_at') THEN
    CREATE INDEX IF NOT EXISTS idx_calls_webhook_received_at ON calls(webhook_received_at);
  END IF;
END $$;

-- ============================================
-- quo_webhook_logs
-- Stores raw webhook payloads for debugging
-- with automatic retention cleanup
-- ============================================
CREATE TABLE IF NOT EXISTS quo_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT NOT NULL, -- Quo webhook event ID
  event_type TEXT NOT NULL, -- call.started, call.ended, call.transcript, etc.
  payload JSONB NOT NULL,
  signature TEXT, -- Webhook signature if provided
  signature_valid BOOLEAN,
  processed BOOLEAN DEFAULT FALSE,
  processing_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON quo_webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON quo_webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed ON quo_webhook_logs(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON quo_webhook_logs(created_at);

-- ============================================
-- quo_contact_mappings
-- Maps Quo contacts to internal leads/deals (sites)
-- ============================================
CREATE TABLE IF NOT EXISTS quo_contact_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quo_contact_id TEXT NOT NULL UNIQUE,
  site_id BIGINT REFERENCES sites(id) ON DELETE CASCADE,
  phone_number TEXT, -- Normalized E.164
  mapped_at TIMESTAMPTZ DEFAULT NOW(),
  mapped_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quo_contact_mappings_contact_id ON quo_contact_mappings(quo_contact_id);
CREATE INDEX IF NOT EXISTS idx_quo_contact_mappings_site_id ON quo_contact_mappings(site_id);
CREATE INDEX IF NOT EXISTS idx_quo_contact_mappings_phone ON quo_contact_mappings(phone_number);

-- ============================================
-- call_events
-- Audit log for call-related events
-- ============================================
CREATE TABLE IF NOT EXISTS call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'linked', 'unlinked', 'transcript_received', 'consent_denied', etc.
  event_data JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_call_events_call_id ON call_events(call_id);
CREATE INDEX IF NOT EXISTS idx_call_events_event_type ON call_events(event_type);
CREATE INDEX IF NOT EXISTS idx_call_events_created_at ON call_events(created_at);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE quo_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quo_contact_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_events ENABLE ROW LEVEL SECURITY;

-- Policies: Allow authenticated users to read their organization's calls
-- Service role can manage all records
CREATE POLICY "Service role full access to calls"
  ON calls
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view calls"
  ON calls
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Webhook logs: Service role only
CREATE POLICY "Service role full access to webhook logs"
  ON quo_webhook_logs
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Contact mappings: Authenticated users can view, service role can manage
CREATE POLICY "Service role full access to contact mappings"
  ON quo_contact_mappings
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view contact mappings"
  ON quo_contact_mappings
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Call events: Authenticated users can view, service role can manage
CREATE POLICY "Service role full access to call events"
  ON call_events
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view call events"
  ON call_events
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- Functions and Triggers
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trg_calls_updated ON calls;
CREATE TRIGGER trg_calls_updated
  BEFORE UPDATE ON calls
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_quo_contact_mappings_updated ON quo_contact_mappings;
CREATE TRIGGER trg_quo_contact_mappings_updated
  BEFORE UPDATE ON quo_contact_mappings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Function to clean up old webhook logs (retention: 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM quo_webhook_logs
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND processed = TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Success notice
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Quo call tracker integration tables created successfully.';
  RAISE NOTICE '📋 Next steps:';
  RAISE NOTICE '   1. Set QUO_API_KEY, QUO_WEBHOOK_SECRET in Supabase secrets';
  RAISE NOTICE '   2. Deploy quo-webhook Edge Function';
  RAISE NOTICE '   3. Configure webhook URL in Quo dashboard';
END $$;
