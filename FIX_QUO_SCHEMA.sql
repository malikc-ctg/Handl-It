-- ============================================
-- FIX: Quo Schema - Create missing tables and fix policies
-- ============================================
-- Run this to fix partial schema installation
-- ============================================

-- Ensure UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Create missing tables
-- ============================================

-- quo_webhook_logs - Stores raw webhook payloads
CREATE TABLE IF NOT EXISTS quo_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  signature TEXT,
  signature_valid BOOLEAN,
  processed BOOLEAN DEFAULT FALSE,
  processing_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for quo_webhook_logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON quo_webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON quo_webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed ON quo_webhook_logs(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON quo_webhook_logs(created_at);

-- quo_contact_mappings - Maps Quo contacts to sites
CREATE TABLE IF NOT EXISTS quo_contact_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quo_contact_id TEXT NOT NULL UNIQUE,
  site_id BIGINT REFERENCES sites(id) ON DELETE CASCADE,
  phone_number TEXT,
  mapped_at TIMESTAMPTZ DEFAULT NOW(),
  mapped_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for quo_contact_mappings
CREATE INDEX IF NOT EXISTS idx_quo_contact_mappings_contact_id ON quo_contact_mappings(quo_contact_id);
CREATE INDEX IF NOT EXISTS idx_quo_contact_mappings_site_id ON quo_contact_mappings(site_id);
CREATE INDEX IF NOT EXISTS idx_quo_contact_mappings_phone ON quo_contact_mappings(phone_number);

-- call_events - Audit log for call events
CREATE TABLE IF NOT EXISTS call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for call_events
CREATE INDEX IF NOT EXISTS idx_call_events_call_id ON call_events(call_id);
CREATE INDEX IF NOT EXISTS idx_call_events_event_type ON call_events(event_type);
CREATE INDEX IF NOT EXISTS idx_call_events_created_at ON call_events(created_at);

-- ============================================
-- Enable RLS on all tables
-- ============================================
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE quo_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quo_contact_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Drop existing policies (if any)
-- ============================================
DROP POLICY IF EXISTS "Service role full access to calls" ON calls;
DROP POLICY IF EXISTS "Authenticated users can view calls" ON calls;
DROP POLICY IF EXISTS "Authenticated users can view their calls" ON calls;
DROP POLICY IF EXISTS "Users can view calls for their sites" ON calls;

DROP POLICY IF EXISTS "Service role full access to webhook logs" ON quo_webhook_logs;

DROP POLICY IF EXISTS "Service role full access to contact mappings" ON quo_contact_mappings;
DROP POLICY IF EXISTS "Authenticated users can view contact mappings" ON quo_contact_mappings;

DROP POLICY IF EXISTS "Service role full access to call events" ON call_events;
DROP POLICY IF EXISTS "Authenticated users can view call events" ON call_events;

-- ============================================
-- Create policies
-- ============================================

-- Calls policies
CREATE POLICY "Service role full access to calls"
  ON calls
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view calls"
  ON calls
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Webhook logs policies (service role only)
CREATE POLICY "Service role full access to webhook logs"
  ON quo_webhook_logs
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Contact mappings policies
CREATE POLICY "Service role full access to contact mappings"
  ON quo_contact_mappings
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view contact mappings"
  ON quo_contact_mappings
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Call events policies
CREATE POLICY "Service role full access to call events"
  ON call_events
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view call events"
  ON call_events
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- Create helper functions
-- ============================================

-- Function to clean up old webhook logs (90 day retention)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM quo_webhook_logs
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND processed = TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Success
-- ============================================
SELECT 'Quo schema setup complete!' AS status;
