-- ============================================
-- CORE SALES CRM DATABASE SCHEMA
-- ============================================
-- Complete implementation of Leads, Contacts, Deals, Quotes, Calls, Messages,
-- Tasks, Sequences, Routes, Territories, Doors, and Event Log
-- ============================================
-- Run this entire script in Supabase SQL Editor
-- ============================================

BEGIN;

-- ============================================
-- ENUMS AND TYPES
-- ============================================

-- Create ENUM types for standardized values
DO $$ 
BEGIN
  -- Lead Status Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
    CREATE TYPE lead_status AS ENUM (
      'new', 'contacted', 'qualified', 'unqualified', 'converted', 'nurturing'
    );
  END IF;

  -- Deal Stage Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deal_stage') THEN
    CREATE TYPE deal_stage AS ENUM (
      'prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'
    );
  END IF;

  -- Deal Health Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deal_health') THEN
    CREATE TYPE deal_health AS ENUM (
      'at_risk', 'on_track', 'exceeding', 'needs_attention'
    );
  END IF;

  -- Lost Reason Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lost_reason') THEN
    CREATE TYPE lost_reason AS ENUM (
      'price_too_high', 'competitor', 'no_decision', 'budget_cut', 
      'timing_not_right', 'features_missing', 'other'
    );
  END IF;

  -- Contact Role Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_role') THEN
    CREATE TYPE contact_role AS ENUM (
      'decision_maker', 'influencer', 'gatekeeper', 'user', 'champion', 'other'
    );
  END IF;

  -- Call Outcome Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_outcome') THEN
    CREATE TYPE call_outcome AS ENUM (
      'connected', 'no_answer', 'voicemail', 'busy', 'failed', 'cancelled', 'missed'
    );
  END IF;

  -- Message Status Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_status') THEN
    CREATE TYPE message_status AS ENUM (
      'pending', 'sent', 'delivered', 'read', 'failed', 'bounced'
    );
  END IF;

  -- Task Status Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM (
      'pending', 'in_progress', 'completed', 'cancelled', 'deferred'
    );
  END IF;

  -- Task Type Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_type') THEN
    CREATE TYPE task_type AS ENUM (
      'call', 'email', 'meeting', 'follow_up', 'quote_preparation', 'proposal_review', 'other'
    );
  END IF;

  -- Door Visit Outcome Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'door_visit_outcome') THEN
    CREATE TYPE door_visit_outcome AS ENUM (
      'met', 'not_home', 'refused', 'left_info', 'follow_up_scheduled', 'not_interested'
    );
  END IF;

  -- Property Type Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'property_type') THEN
    CREATE TYPE property_type AS ENUM (
      'residential', 'commercial', 'industrial', 'retail', 'office', 'mixed_use', 'other'
    );
  END IF;

  -- Route Status Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'route_status') THEN
    CREATE TYPE route_status AS ENUM (
      'planned', 'in_progress', 'completed', 'cancelled'
    );
  END IF;

  -- Event Type (text-based for flexibility)
  -- Will be validated in application layer or trigger

END $$;

-- ============================================
-- 1. LEADS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID, -- References company_profiles(id) if exists, otherwise NULL
  
  -- Lead Information
  source TEXT NOT NULL, -- 'website', 'referral', 'cold_outreach', 'event', 'social', etc.
  status lead_status NOT NULL DEFAULT 'new',
  
  -- Primary Contact
  primary_contact_id UUID, -- Will reference contacts table
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
  
  -- Note: Foreign key constraint to company_profiles will be added conditionally
  -- in CORE_SALES_CRM_RLS_AND_CONSTRAINTS.sql if company_profiles table exists
);

-- ============================================
-- 2. CONTACTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID, -- References company_profiles(id)
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- Contact Information
  normalized_phone TEXT, -- E.164 format: +1234567890
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT GENERATED ALWAYS AS (
    CASE 
      WHEN first_name IS NOT NULL AND last_name IS NOT NULL 
        THEN first_name || ' ' || last_name
      WHEN first_name IS NOT NULL THEN first_name
      WHEN last_name IS NOT NULL THEN last_name
      ELSE NULL
    END
  ) STORED,
  
  -- Role and Organization
  role contact_role DEFAULT 'other',
  company_name TEXT,
  title TEXT,
  
  -- Address Fields
  street_address TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  
  -- Additional
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT contacts_email_or_phone CHECK (
    email IS NOT NULL OR normalized_phone IS NOT NULL
  )
);

-- Update leads table to reference contacts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_leads_primary_contact'
    ) THEN
      ALTER TABLE leads 
      ADD CONSTRAINT fk_leads_primary_contact 
      FOREIGN KEY (primary_contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ============================================
-- 3. DEAL STAGES TABLE (Configuration)
-- ============================================
CREATE TABLE IF NOT EXISTS deal_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID, -- NULL for default stages, UUID for custom stages
  
  stage_name TEXT NOT NULL,
  stage_enum deal_stage NOT NULL,
  display_order INTEGER DEFAULT 0,
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(workspace_id, stage_enum) -- Only one active stage per enum per workspace
);

-- ============================================
-- 4. DEALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID, -- References company_profiles(id)
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- Deal Information
  title TEXT NOT NULL,
  stage deal_stage NOT NULL DEFAULT 'prospecting',
  deal_stage_id UUID REFERENCES deal_stages(id) ON DELETE SET NULL,
  
  -- Financial
  value_estimate NUMERIC(12, 2),
  currency TEXT DEFAULT 'USD',
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  
  -- Health and Status
  health deal_health DEFAULT 'on_track',
  lost_reason lost_reason,
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  
  -- Assignment
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Tracking
  last_touch_at TIMESTAMPTZ,
  expected_close_date DATE,
  
  -- Additional
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT deals_won_lost_check CHECK (
    (stage = 'closed_won' AND won_at IS NOT NULL AND lost_at IS NULL) OR
    (stage = 'closed_lost' AND lost_at IS NOT NULL AND won_at IS NULL AND lost_reason IS NOT NULL) OR
    (stage NOT IN ('closed_won', 'closed_lost'))
  )
);

-- ============================================
-- 5. QUOTE TEMPLATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS quote_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID, -- References company_profiles(id)
  
  name TEXT NOT NULL,
  description TEXT,
  vertical TEXT, -- 'commercial_cleaning', 'maintenance', etc.
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(workspace_id, name)
);

-- ============================================
-- 6. QUOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  quote_template_id UUID REFERENCES quote_templates(id) ON DELETE SET NULL,
  
  -- Versioning
  quote_version INTEGER NOT NULL DEFAULT 1,
  variant TEXT CHECK (variant IN ('good', 'better', 'best')),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'drafted' CHECK (status IN (
    'drafted', 'sent', 'viewed', 'accepted', 'rejected', 'expired'
  )),
  
  -- Financial
  total_amount NUMERIC(12, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  valid_until DATE,
  
  -- Additional
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  
  -- Constraints
  UNIQUE(deal_id, quote_version)
);

-- ============================================
-- 7. QUOTE LINE ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS quote_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  
  -- Line Item Details
  description TEXT NOT NULL,
  category TEXT, -- 'labor', 'materials', 'equipment', 'service', etc.
  quantity NUMERIC(10, 2) DEFAULT 1,
  unit TEXT DEFAULT 'item', -- 'hour', 'sqft', 'item', etc.
  unit_price NUMERIC(10, 2) NOT NULL,
  total NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  
  -- Margin Fields (Admin-only via metadata)
  cost_basis NUMERIC(10, 2), -- Hidden from customer
  margin_percentage NUMERIC(5, 2), -- Hidden from customer
  margin_amount NUMERIC(10, 2) GENERATED ALWAYS AS (
    CASE 
      WHEN cost_basis IS NOT NULL THEN (quantity * unit_price) - (quantity * cost_basis)
      ELSE NULL
    END
  ) STORED,
  
  -- Ordering
  sequence_order INTEGER DEFAULT 0,
  
  -- Additional
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. CALLS TABLE (Enhanced for Quo Integration)
-- ============================================
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- Quo Integration (Critical)
  quo_call_id TEXT UNIQUE NOT NULL, -- Provider event ID for idempotency
  
  -- Call Details
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL, -- Normalized E.164
  to_number TEXT NOT NULL, -- Normalized E.164
  from_number_raw TEXT, -- Original format
  to_number_raw TEXT, -- Original format
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  duration_seconds INTEGER, -- Calculated or provided
  
  -- Outcome
  outcome call_outcome NOT NULL,
  status TEXT DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'answered', 'completed', 'failed')),
  
  -- Content (Consent-gated)
  call_recording_consent BOOLEAN DEFAULT FALSE,
  recording_url TEXT, -- Only if consent
  transcript_text TEXT, -- Only if consent
  summary_text TEXT, -- AI-generated summary
  
  -- Objection Tags
  objection_tags TEXT[], -- Array of objection tags
  
  -- Additional
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT calls_consent_check CHECK (
    (recording_url IS NULL AND transcript_text IS NULL) OR 
    call_recording_consent = TRUE
  )
);

-- ============================================
-- 9. MESSAGES TABLE (SMS/Email)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- Provider Information
  provider TEXT NOT NULL, -- 'twilio', 'sendgrid', 'resend', etc.
  provider_message_id TEXT, -- Provider's message ID
  
  -- Message Details
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'whatsapp', 'push')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  
  -- Content
  subject TEXT, -- For email
  body TEXT NOT NULL,
  
  -- Recipients (Normalized)
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  
  -- Status Tracking
  status message_status NOT NULL DEFAULT 'pending',
  
  -- Timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  
  -- Additional
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. TASKS TABLE (Next Actions)
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- Task Details
  title TEXT NOT NULL,
  description TEXT,
  type task_type NOT NULL,
  status task_status NOT NULL DEFAULT 'pending',
  
  -- Assignment
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Scheduling
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Priority
  priority INTEGER DEFAULT 0 CHECK (priority >= 0 AND priority <= 5),
  
  -- Additional
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. SEQUENCES TABLE (Follow-up Automation)
-- ============================================
CREATE TABLE IF NOT EXISTS sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  
  name TEXT NOT NULL,
  description TEXT,
  
  -- Trigger
  stage_trigger deal_stage, -- Stage that triggers this sequence
  
  -- Stop Rules
  stop_on_reply BOOLEAN DEFAULT TRUE,
  stop_on_stage_change BOOLEAN DEFAULT TRUE,
  stop_on_deal_closed BOOLEAN DEFAULT TRUE,
  max_attempts INTEGER,
  
  -- Status
  enabled BOOLEAN DEFAULT TRUE,
  
  -- Additional
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. SEQUENCE STEPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES sequences(id) ON DELETE CASCADE,
  
  step_order INTEGER NOT NULL,
  
  -- Action Details
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'call', 'task')),
  
  -- Template Reference
  email_template_id UUID, -- Reference to email templates table if exists
  sms_template_id UUID, -- Reference to SMS templates table if exists
  
  -- Content (fallback if no template)
  subject TEXT,
  body TEXT,
  
  -- Additional
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(sequence_id, step_order)
);

-- ============================================
-- 13. SEQUENCE EXECUTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sequence_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES sequences(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Execution State
  current_step INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'stopped', 'completed')),
  stopped_reason TEXT,
  
  -- Tracking
  attempt_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  next_execution_at TIMESTAMPTZ,
  
  -- Additional
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 14. TERRITORIES TABLE (Geographic Areas)
-- ============================================
CREATE TABLE IF NOT EXISTS territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  
  name TEXT NOT NULL,
  description TEXT,
  
  -- Geographic Boundaries
  -- Option 1: PostGIS (if extension available)
  -- boundary GEOGRAPHY(POLYGON, 4326),
  
  -- Option 2: Bounding Box + Encoded Polyline + GeoJSON (fallback)
  min_latitude NUMERIC(10, 8),
  max_latitude NUMERIC(10, 8),
  min_longitude NUMERIC(11, 8),
  max_longitude NUMERIC(11, 8),
  encoded_polyline TEXT, -- Google Polyline encoding
  geojson JSONB, -- GeoJSON polygon representation
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Additional
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Check if PostGIS is available and add geography column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    -- Add PostGIS geography column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'territories' AND column_name = 'boundary'
    ) THEN
      ALTER TABLE territories ADD COLUMN boundary GEOGRAPHY(POLYGON, 4326);
    END IF;
  END IF;
END $$;

-- ============================================
-- 15. ROUTES TABLE (Sales Routes)
-- ============================================
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  territory_id UUID REFERENCES territories(id) ON DELETE SET NULL,
  
  -- Route Details
  route_date DATE NOT NULL,
  name TEXT, -- Optional route name
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Status
  status route_status NOT NULL DEFAULT 'planned',
  
  -- Tracking
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Location Tracking
  location_tracking_enabled BOOLEAN DEFAULT FALSE,
  
  -- Additional
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 16. DOORS TABLE (Door Targets)
-- ============================================
CREATE TABLE IF NOT EXISTS doors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  territory_id UUID REFERENCES territories(id) ON DELETE SET NULL,
  
  -- Location
  address TEXT NOT NULL,
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  
  -- Property Information
  property_type property_type,
  property_name TEXT, -- Building/complex name
  
  -- Classification
  tags TEXT[] DEFAULT '{}',
  
  -- Cooldown (to prevent too-frequent visits)
  cooldown_until TIMESTAMPTZ,
  last_visit_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Additional
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 17. DOOR VISITS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS door_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
  door_id UUID REFERENCES doors(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  
  -- Visit Details
  visit_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcome door_visit_outcome,
  
  -- Notes and Follow-up
  notes TEXT,
  follow_up_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  
  -- Location (for verification)
  visit_latitude NUMERIC(10, 8),
  visit_longitude NUMERIC(11, 8),
  
  -- Additional
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 18. EVENTS TABLE (Immutable Event Log)
-- ============================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event Classification
  event_type TEXT NOT NULL, -- Flexible text field for various event types
  entity_type TEXT NOT NULL, -- 'lead', 'deal', 'contact', 'call', 'message', etc.
  entity_id UUID NOT NULL,
  
  -- Actor (who/what caused the event)
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'customer', 'automation')),
  actor_id UUID, -- References auth.users(id) if actor_type = 'user'
  
  -- Event Data
  payload JSONB DEFAULT '{}',
  
  -- Immutable Timestamp
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- No updated_at - events are immutable
  
  -- Index for fast lookups
  CONSTRAINT events_entity_index CHECK (entity_type IS NOT NULL AND entity_id IS NOT NULL)
);

-- Make events table immutable (prevent updates/deletes via policy)
-- We'll add this in RLS policies section

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Ensure workspace_id columns exist before creating indexes
DO $$
BEGIN
  -- Add workspace_id to leads if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'workspace_id') THEN
      ALTER TABLE leads ADD COLUMN workspace_id UUID;
    END IF;
  END IF;
  
  -- Add workspace_id to contacts if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contacts') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'workspace_id') THEN
      ALTER TABLE contacts ADD COLUMN workspace_id UUID;
    END IF;
  END IF;
  
  -- Add workspace_id to deals if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deals') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'workspace_id') THEN
      ALTER TABLE deals ADD COLUMN workspace_id UUID;
    END IF;
  END IF;
  
  -- Add workspace_id to calls if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calls') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'workspace_id') THEN
      ALTER TABLE calls ADD COLUMN workspace_id UUID;
    END IF;
  END IF;
  
  -- Add workspace_id to messages if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'workspace_id') THEN
      ALTER TABLE messages ADD COLUMN workspace_id UUID;
    END IF;
  END IF;
  
  -- Add workspace_id to tasks if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'workspace_id') THEN
      ALTER TABLE tasks ADD COLUMN workspace_id UUID;
    END IF;
  END IF;
  
  -- Add workspace_id to sequences if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sequences') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sequences' AND column_name = 'workspace_id') THEN
      ALTER TABLE sequences ADD COLUMN workspace_id UUID;
    END IF;
  END IF;
  
  -- Add workspace_id to routes if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'routes') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'workspace_id') THEN
      ALTER TABLE routes ADD COLUMN workspace_id UUID;
    END IF;
  END IF;
  
  -- Add workspace_id to doors if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'doors') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'doors' AND column_name = 'workspace_id') THEN
      ALTER TABLE doors ADD COLUMN workspace_id UUID;
    END IF;
  END IF;
  
  -- Add deal_id columns if they don't exist (for tables that reference deals)
  -- Quotes
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quotes') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'deal_id') THEN
      ALTER TABLE quotes ADD COLUMN deal_id UUID;
    END IF;
  END IF;
  
  -- Calls
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calls') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'deal_id') THEN
      ALTER TABLE calls ADD COLUMN deal_id UUID;
    END IF;
  END IF;
  
  -- Messages
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'deal_id') THEN
      ALTER TABLE messages ADD COLUMN deal_id UUID;
    END IF;
  END IF;
  
  -- Tasks
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'deal_id') THEN
      ALTER TABLE tasks ADD COLUMN deal_id UUID;
    END IF;
  END IF;
  
  -- Sequence Executions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sequence_executions') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sequence_executions' AND column_name = 'deal_id') THEN
      ALTER TABLE sequence_executions ADD COLUMN deal_id UUID;
    END IF;
  END IF;
  
  -- Door Visits
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'door_visits') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'door_visits' AND column_name = 'deal_id') THEN
      ALTER TABLE door_visits ADD COLUMN deal_id UUID;
    END IF;
  END IF;
  
  -- Add other foreign key columns if they don't exist
  -- Contacts: lead_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contacts') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'lead_id') THEN
      ALTER TABLE contacts ADD COLUMN lead_id UUID;
    END IF;
  END IF;
  
  -- Leads: primary_contact_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'primary_contact_id') THEN
      ALTER TABLE leads ADD COLUMN primary_contact_id UUID;
    END IF;
  END IF;
  
  -- Deals: lead_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deals') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'lead_id') THEN
      ALTER TABLE deals ADD COLUMN lead_id UUID;
    END IF;
  END IF;
  
  -- Quote Line Items: quote_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quote_line_items') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'quote_id') THEN
      ALTER TABLE quote_line_items ADD COLUMN quote_id UUID;
    END IF;
  END IF;
  
  -- Calls: lead_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calls') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'lead_id') THEN
      ALTER TABLE calls ADD COLUMN lead_id UUID;
    END IF;
  END IF;
  
  -- Messages: lead_id, provider, provider_message_id, channel, direction, etc.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'lead_id') THEN
      ALTER TABLE messages ADD COLUMN lead_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'provider') THEN
      ALTER TABLE messages ADD COLUMN provider TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'provider_message_id') THEN
      ALTER TABLE messages ADD COLUMN provider_message_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'channel') THEN
      ALTER TABLE messages ADD COLUMN channel TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'direction') THEN
      ALTER TABLE messages ADD COLUMN direction TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'from_address') THEN
      ALTER TABLE messages ADD COLUMN from_address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'to_address') THEN
      ALTER TABLE messages ADD COLUMN to_address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'body') THEN
      ALTER TABLE messages ADD COLUMN body TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'status') THEN
      -- Check if message_status ENUM exists, if not create it, then add column
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_status') THEN
        ALTER TABLE messages ADD COLUMN status message_status DEFAULT 'pending';
      ELSE
        -- If ENUM doesn't exist, add as TEXT (will be converted later if needed)
        ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'pending';
      END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'subject') THEN
      ALTER TABLE messages ADD COLUMN subject TEXT;
    END IF;
  END IF;
  
  -- Tasks: status (check if task_status ENUM exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'status') THEN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        ALTER TABLE tasks ADD COLUMN status task_status DEFAULT 'pending';
      ELSE
        ALTER TABLE tasks ADD COLUMN status TEXT DEFAULT 'pending';
      END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'title') THEN
      ALTER TABLE tasks ADD COLUMN title TEXT;
    END IF;
  END IF;
  
  -- Tasks: lead_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'lead_id') THEN
      ALTER TABLE tasks ADD COLUMN lead_id UUID;
    END IF;
  END IF;
  
  -- Sequence Executions: sequence_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sequence_executions') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sequence_executions' AND column_name = 'sequence_id') THEN
      ALTER TABLE sequence_executions ADD COLUMN sequence_id UUID;
    END IF;
  END IF;
  
  -- Door Visits: route_id, door_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'door_visits') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'door_visits' AND column_name = 'route_id') THEN
      ALTER TABLE door_visits ADD COLUMN route_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'door_visits' AND column_name = 'door_id') THEN
      ALTER TABLE door_visits ADD COLUMN door_id UUID;
    END IF;
  END IF;
  
  -- Doors: territory_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'doors') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'doors' AND column_name = 'territory_id') THEN
      ALTER TABLE doors ADD COLUMN territory_id UUID;
    END IF;
  END IF;
  
  -- Routes: territory_id, assigned_user_id, status, route_date
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'routes') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'territory_id') THEN
      ALTER TABLE routes ADD COLUMN territory_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'assigned_user_id') THEN
      ALTER TABLE routes ADD COLUMN assigned_user_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'status') THEN
      ALTER TABLE routes ADD COLUMN status TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'route_date') THEN
      ALTER TABLE routes ADD COLUMN route_date DATE;
    END IF;
  END IF;
  
  -- Tasks: assigned_user_id, due_at, status
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'assigned_user_id') THEN
      ALTER TABLE tasks ADD COLUMN assigned_user_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'due_at') THEN
      ALTER TABLE tasks ADD COLUMN due_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'status') THEN
      ALTER TABLE tasks ADD COLUMN status TEXT;
    END IF;
  END IF;
  
  -- Sequence Executions: status, next_execution_at
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sequence_executions') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sequence_executions' AND column_name = 'status') THEN
      ALTER TABLE sequence_executions ADD COLUMN status TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sequence_executions' AND column_name = 'next_execution_at') THEN
      ALTER TABLE sequence_executions ADD COLUMN next_execution_at TIMESTAMPTZ;
    END IF;
  END IF;
  
  -- Sequences: stage_trigger, enabled
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sequences') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sequences' AND column_name = 'stage_trigger') THEN
      ALTER TABLE sequences ADD COLUMN stage_trigger TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sequences' AND column_name = 'enabled') THEN
      ALTER TABLE sequences ADD COLUMN enabled BOOLEAN DEFAULT TRUE;
    END IF;
  END IF;
  
  -- Calls: quo_call_id, from_number, to_number, started_at
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calls') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'quo_call_id') THEN
      ALTER TABLE calls ADD COLUMN quo_call_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'from_number') THEN
      ALTER TABLE calls ADD COLUMN from_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'to_number') THEN
      ALTER TABLE calls ADD COLUMN to_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'started_at') THEN
      ALTER TABLE calls ADD COLUMN started_at TIMESTAMPTZ;
    END IF;
  END IF;
  
  -- Doors: cooldown_until, latitude, longitude
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'doors') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'doors' AND column_name = 'cooldown_until') THEN
      ALTER TABLE doors ADD COLUMN cooldown_until TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'doors' AND column_name = 'latitude') THEN
      ALTER TABLE doors ADD COLUMN latitude NUMERIC(10, 7);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'doors' AND column_name = 'longitude') THEN
      ALTER TABLE doors ADD COLUMN longitude NUMERIC(10, 7);
    END IF;
  END IF;
  
  -- Door Visits: visit_timestamp
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'door_visits') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'door_visits' AND column_name = 'visit_timestamp') THEN
      ALTER TABLE door_visits ADD COLUMN visit_timestamp TIMESTAMPTZ;
    END IF;
  END IF;
  
  -- Quotes: quote_template_id, quote_version
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quotes') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'quote_template_id') THEN
      ALTER TABLE quotes ADD COLUMN quote_template_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'quote_version') THEN
      ALTER TABLE quotes ADD COLUMN quote_version INTEGER DEFAULT 1;
    END IF;
  END IF;
END $$;

-- Leads Indexes
CREATE INDEX IF NOT EXISTS idx_leads_workspace_id ON leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_updated ON leads(workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_primary_contact ON leads(primary_contact_id);

-- Contacts Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_workspace_id ON contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_normalized_phone ON contacts(normalized_phone);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_lead_id ON contacts(lead_id);

-- Deals Indexes
CREATE INDEX IF NOT EXISTS idx_deals_workspace_id ON deals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_deals_workspace_updated ON deals(workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_stage_last_touch ON deals(stage, last_touch_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_deals_assigned_user ON deals(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);

-- Quotes Indexes
CREATE INDEX IF NOT EXISTS idx_quotes_deal_id ON quotes(deal_id);
CREATE INDEX IF NOT EXISTS idx_quotes_template_id ON quotes(quote_template_id);
CREATE INDEX IF NOT EXISTS idx_quotes_version ON quotes(deal_id, quote_version);

-- Quote Line Items Indexes
CREATE INDEX IF NOT EXISTS idx_quote_line_items_quote_id ON quote_line_items(quote_id);

-- Calls Indexes (Critical for Quo Integration)
CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_quo_call_id_unique ON calls(quo_call_id);
CREATE INDEX IF NOT EXISTS idx_calls_workspace_id ON calls(workspace_id);
CREATE INDEX IF NOT EXISTS idx_calls_deal_id ON calls(deal_id);
CREATE INDEX IF NOT EXISTS idx_calls_from_number ON calls(from_number);
CREATE INDEX IF NOT EXISTS idx_calls_to_number ON calls(to_number);
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at DESC);

-- Messages Indexes
CREATE INDEX IF NOT EXISTS idx_messages_workspace_id ON messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_deal_id ON messages(deal_id);
CREATE INDEX IF NOT EXISTS idx_messages_provider_message_id ON messages(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_direction ON messages(channel, direction);

-- Tasks Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deal_id ON tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user ON tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at) WHERE status NOT IN ('completed', 'cancelled');

-- Sequences Indexes
CREATE INDEX IF NOT EXISTS idx_sequences_workspace_id ON sequences(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sequences_stage_trigger ON sequences(stage_trigger) WHERE enabled = TRUE;

-- Sequence Executions Indexes
CREATE INDEX IF NOT EXISTS idx_sequence_executions_deal_id ON sequence_executions(deal_id);
CREATE INDEX IF NOT EXISTS idx_sequence_executions_status ON sequence_executions(status);
CREATE INDEX IF NOT EXISTS idx_sequence_executions_next_execution ON sequence_executions(next_execution_at) 
  WHERE status = 'active';

-- Routes Indexes (Critical)
CREATE INDEX IF NOT EXISTS idx_routes_workspace_id ON routes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_route_date ON routes(route_date);
CREATE INDEX IF NOT EXISTS idx_routes_assigned_user ON routes(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_routes_route_id_status ON routes(id, status);

-- Doors Indexes
CREATE INDEX IF NOT EXISTS idx_doors_workspace_id ON doors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_doors_territory_id ON doors(territory_id);
CREATE INDEX IF NOT EXISTS idx_doors_cooldown ON doors(cooldown_until) WHERE cooldown_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doors_location ON doors(latitude, longitude) 
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Door Visits Indexes
CREATE INDEX IF NOT EXISTS idx_door_visits_route_id ON door_visits(route_id);
CREATE INDEX IF NOT EXISTS idx_door_visits_door_id ON door_visits(door_id);
CREATE INDEX IF NOT EXISTS idx_door_visits_visit_timestamp ON door_visits(visit_timestamp DESC);

-- Events Indexes (Critical for Event Stream)
CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_actor ON events(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_entity_timestamp ON events(entity_type, entity_id, timestamp DESC);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to emit events (Helper for services)
CREATE OR REPLACE FUNCTION emit_event(
  p_event_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_actor_type TEXT,
  p_actor_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO events (
    event_type,
    entity_type,
    entity_id,
    actor_type,
    actor_id,
    payload,
    timestamp
  )
  VALUES (
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_actor_type,
    p_actor_id,
    p_payload,
    NOW()
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Grant execute on emit_event function
GRANT EXECUTE ON FUNCTION emit_event(TEXT, TEXT, UUID, TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION emit_event(TEXT, TEXT, UUID, TEXT, UUID, JSONB) TO service_role;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trg_leads_updated ON leads;
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_contacts_updated ON contacts;
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_deals_updated ON deals;
CREATE TRIGGER trg_deals_updated BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_quotes_updated ON quotes;
CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_sequences_updated ON sequences;
CREATE TRIGGER trg_sequences_updated BEFORE UPDATE ON sequences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_sequence_executions_updated ON sequence_executions;
CREATE TRIGGER trg_sequence_executions_updated BEFORE UPDATE ON sequence_executions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_routes_updated ON routes;
CREATE TRIGGER trg_routes_updated BEFORE UPDATE ON routes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_doors_updated ON doors;
CREATE TRIGGER trg_doors_updated BEFORE UPDATE ON doors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_calls_updated ON calls;
CREATE TRIGGER trg_calls_updated BEFORE UPDATE ON calls
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_messages_updated ON messages;
CREATE TRIGGER trg_messages_updated BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated ON tasks;
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_territories_updated ON territories;
CREATE TRIGGER trg_territories_updated BEFORE UPDATE ON territories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trigger to automatically update last_touch_at on deals when related activities occur
CREATE OR REPLACE FUNCTION update_deal_last_touch()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'calls' AND NEW.deal_id IS NOT NULL THEN
    UPDATE deals SET last_touch_at = NEW.started_at WHERE id = NEW.deal_id;
  ELSIF TG_TABLE_NAME = 'messages' AND NEW.deal_id IS NOT NULL THEN
    UPDATE deals SET last_touch_at = NEW.created_at WHERE id = NEW.deal_id;
  ELSIF TG_TABLE_NAME = 'door_visits' AND NEW.deal_id IS NOT NULL THEN
    UPDATE deals SET last_touch_at = NEW.visit_timestamp WHERE id = NEW.deal_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_deal_touch_on_call ON calls;
CREATE TRIGGER trg_update_deal_touch_on_call
  AFTER INSERT ON calls
  FOR EACH ROW EXECUTE FUNCTION update_deal_last_touch();

DROP TRIGGER IF EXISTS trg_update_deal_touch_on_message ON messages;
CREATE TRIGGER trg_update_deal_touch_on_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_deal_last_touch();

DROP TRIGGER IF EXISTS trg_update_deal_touch_on_door_visit ON door_visits;
CREATE TRIGGER trg_update_deal_touch_on_door_visit
  AFTER INSERT ON door_visits
  FOR EACH ROW EXECUTE FUNCTION update_deal_last_touch();

-- Trigger to update door cooldown and last_visit_at
CREATE OR REPLACE FUNCTION update_door_visit_tracking()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE doors 
  SET 
    last_visit_at = NEW.visit_timestamp,
    cooldown_until = NEW.visit_timestamp + INTERVAL '30 days' -- 30-day cooldown by default
  WHERE id = NEW.door_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_door_visit_tracking ON door_visits;
CREATE TRIGGER trg_update_door_visit_tracking
  AFTER INSERT ON door_visits
  FOR EACH ROW EXECUTE FUNCTION update_door_visit_tracking();

-- Trigger to auto-emit events for deal changes
CREATE OR REPLACE FUNCTION emit_deal_events()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_actor_id UUID;
BEGIN
  v_actor_id := COALESCE(NEW.assigned_user_id, auth.uid());
  
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'deal.created';
    PERFORM emit_event(
      v_event_type,
      'deal',
      NEW.id,
      'user',
      v_actor_id,
      jsonb_build_object('deal', to_jsonb(NEW))
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
      v_event_type := 'deal.stage_changed';
      PERFORM emit_event(
        v_event_type,
        'deal',
        NEW.id,
        'user',
        v_actor_id,
        jsonb_build_object(
          'old_stage', OLD.stage,
          'new_stage', NEW.stage,
          'deal', to_jsonb(NEW)
        )
      );
    END IF;
    
    IF OLD.value_estimate IS DISTINCT FROM NEW.value_estimate THEN
      v_event_type := 'deal.value_changed';
      PERFORM emit_event(
        v_event_type,
        'deal',
        NEW.id,
        'user',
        v_actor_id,
        jsonb_build_object(
          'old_value', OLD.value_estimate,
          'new_value', NEW.value_estimate,
          'deal', to_jsonb(NEW)
        )
      );
    END IF;
    
    IF NEW.won_at IS NOT NULL AND OLD.won_at IS NULL THEN
      v_event_type := 'deal.won';
      PERFORM emit_event(
        v_event_type,
        'deal',
        NEW.id,
        'user',
        v_actor_id,
        jsonb_build_object('deal', to_jsonb(NEW))
      );
    END IF;
    
    IF NEW.lost_at IS NOT NULL AND OLD.lost_at IS NULL THEN
      v_event_type := 'deal.lost';
      PERFORM emit_event(
        v_event_type,
        'deal',
        NEW.id,
        'user',
        v_actor_id,
        jsonb_build_object('deal', to_jsonb(NEW), 'lost_reason', NEW.lost_reason)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_emit_deal_events ON deals;
CREATE TRIGGER trg_emit_deal_events
  AFTER INSERT OR UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION emit_deal_events();

COMMIT;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ CORE SALES CRM SCHEMA CREATED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Tables Created:';
  RAISE NOTICE '   • leads';
  RAISE NOTICE '   • contacts';
  RAISE NOTICE '   • deal_stages';
  RAISE NOTICE '   • deals';
  RAISE NOTICE '   • quote_templates';
  RAISE NOTICE '   • quotes';
  RAISE NOTICE '   • quote_line_items';
  RAISE NOTICE '   • calls (Quo-integrated)';
  RAISE NOTICE '   • messages';
  RAISE NOTICE '   • tasks';
  RAISE NOTICE '   • sequences';
  RAISE NOTICE '   • sequence_steps';
  RAISE NOTICE '   • sequence_executions';
  RAISE NOTICE '   • territories';
  RAISE NOTICE '   • routes';
  RAISE NOTICE '   • doors';
  RAISE NOTICE '   • door_visits';
  RAISE NOTICE '   • events (immutable event log)';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '   1. Run RLS policies migration';
  RAISE NOTICE '   2. Add workspace_id foreign keys if company_profiles exists';
  RAISE NOTICE '   3. Seed default deal stages';
  RAISE NOTICE '   4. Run unit tests';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
