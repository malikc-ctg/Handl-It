-- ============================================
-- Messaging & Sequences System
-- ============================================
-- Implements SMS/Email outbound sending, inbound recording,
-- template library, stage-based sequences with stop rules
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================
-- MESSAGE PROVIDERS TABLE
-- ============================================
-- Stores configuration for different messaging providers
CREATE TABLE IF NOT EXISTS message_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- 'resend', 'twilio', 'quo', etc.
  type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- One default per type
  config JSONB NOT NULL, -- API keys, credentials, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_providers_type ON message_providers(type);
CREATE INDEX IF NOT EXISTS idx_message_providers_enabled ON message_providers(enabled);

-- ============================================
-- MESSAGE TEMPLATES TABLE
-- ============================================
-- Reusable templates organized by vertical and objection type
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  vertical TEXT, -- 'facilities', 'commercial', 'residential', etc.
  objection_type TEXT, -- 'price', 'timing', 'quality', 'competitor', etc.
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  subject TEXT, -- For emails only
  body TEXT NOT NULL, -- Template body with {{variable}} placeholders
  variables JSONB DEFAULT '[]'::jsonb, -- Available variables: ['name', 'site_name', 'deal_value', etc.]
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_vertical ON message_templates(vertical);
CREATE INDEX IF NOT EXISTS idx_message_templates_objection_type ON message_templates(objection_type);
CREATE INDEX IF NOT EXISTS idx_message_templates_channel ON message_templates(channel);
CREATE INDEX IF NOT EXISTS idx_message_templates_active ON message_templates(is_active);

-- ============================================
-- SEQUENCES TABLE
-- ============================================
-- Defines multi-step follow-up sequences
CREATE TABLE IF NOT EXISTS sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  vertical TEXT,
  is_active BOOLEAN DEFAULT true,
  stop_rules JSONB DEFAULT '{}'::jsonb, -- {"on_reply": true, "on_stage_change": ["won", "lost"], etc.}
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sequences_vertical ON sequences(vertical);
CREATE INDEX IF NOT EXISTS idx_sequences_active ON sequences(is_active);

-- ============================================
-- SEQUENCE STEPS TABLE
-- ============================================
-- Steps within a sequence
CREATE TABLE IF NOT EXISTS sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES sequences(id) ON DELETE CASCADE NOT NULL,
  step_order INTEGER NOT NULL, -- 1, 2, 3, etc.
  delay_days INTEGER DEFAULT 0, -- Days to wait after previous step (or enrollment)
  delay_hours INTEGER DEFAULT 0, -- Additional hours
  template_id UUID REFERENCES message_templates(id) ON DELETE RESTRICT NOT NULL,
  conditions JSONB DEFAULT '{}'::jsonb, -- Optional conditions for this step
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sequence_steps_sequence_id ON sequence_steps(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_steps_order ON sequence_steps(sequence_id, step_order);

-- ============================================
-- SEQUENCE ENROLLMENTS TABLE
-- ============================================
-- Links sequences to entities (sites/deals, bookings, etc.)
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES sequences(id) ON DELETE CASCADE NOT NULL,
  entity_type TEXT NOT NULL, -- 'site', 'booking', 'job', etc.
  entity_id TEXT NOT NULL, -- UUID or BIGINT ID
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'stopped')),
  current_step_order INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  stop_reason TEXT, -- 'reply', 'stage_change', 'manual', etc.
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional context
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_sequence_id ON sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_entity ON sequence_enrollments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status ON sequence_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_started_at ON sequence_enrollments(started_at);

-- ============================================
-- OUTBOUND MESSAGES TABLE
-- ============================================
-- All outbound messages sent (email/SMS)
CREATE TABLE IF NOT EXISTS messages_outbound (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES sequence_enrollments(id) ON DELETE SET NULL,
  step_id UUID REFERENCES sequence_steps(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  provider_id UUID REFERENCES message_providers(id) ON DELETE SET NULL,
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_name TEXT,
  subject TEXT, -- For emails
  body TEXT NOT NULL, -- Final rendered body
  template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'failed', 'replied')),
  provider_message_id TEXT, -- External provider's message ID
  provider_response JSONB, -- Full provider response
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  scheduled_for TIMESTAMPTZ, -- When to send (for queued messages)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_outbound_enrollment_id ON messages_outbound(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_messages_outbound_status ON messages_outbound(status);
CREATE INDEX IF NOT EXISTS idx_messages_outbound_scheduled_for ON messages_outbound(scheduled_for) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_messages_outbound_recipient_email ON messages_outbound(recipient_email);
CREATE INDEX IF NOT EXISTS idx_messages_outbound_recipient_phone ON messages_outbound(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_messages_outbound_channel ON messages_outbound(channel);

-- ============================================
-- INBOUND MESSAGES TABLE
-- ============================================
-- Records inbound messages from providers (Quo, Twilio, etc.)
CREATE TABLE IF NOT EXISTS messages_inbound (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  provider_id UUID REFERENCES message_providers(id) ON DELETE SET NULL,
  sender_email TEXT,
  sender_phone TEXT,
  sender_name TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  subject TEXT, -- For emails
  body TEXT NOT NULL,
  provider_message_id TEXT, -- External provider's message ID
  raw_data JSONB, -- Full provider webhook payload
  matched_  enrollment_id UUID REFERENCES sequence_enrollments(id) ON DELETE SET NULL, -- Auto-matched enrollment
  matched_enrollment_id UUID REFERENCES sequence_enrollments(id) ON DELETE SET NULL, -- Auto-matched enrollment (for consistency)
  processed BOOLEAN DEFAULT false, -- Whether we've processed this for stop rules
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_inbound_sender_email ON messages_inbound(sender_email);
CREATE INDEX IF NOT EXISTS idx_messages_inbound_sender_phone ON messages_inbound(sender_phone);
CREATE INDEX IF NOT EXISTS idx_messages_inbound_processed ON messages_inbound(processed);
CREATE INDEX IF NOT EXISTS idx_messages_inbound_created_at ON messages_inbound(created_at DESC);

-- ============================================
-- MESSAGE AUDIT LOG TABLE
-- ============================================
-- Comprehensive audit log for all messaging activities
CREATE TABLE IF NOT EXISTS message_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages_outbound(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'sent', 'delivered', 'failed', 'retried', etc.
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Who triggered (if manual)
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_audit_log_message_id ON message_audit_log(message_id);
CREATE INDEX IF NOT EXISTS idx_message_audit_log_created_at ON message_audit_log(created_at DESC);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamps
CREATE OR REPLACE FUNCTION update_messaging_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_message_providers_updated_at ON message_providers;
CREATE TRIGGER trigger_update_message_providers_updated_at
  BEFORE UPDATE ON message_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_messaging_updated_at();

DROP TRIGGER IF EXISTS trigger_update_message_templates_updated_at ON message_templates;
CREATE TRIGGER trigger_update_message_templates_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_messaging_updated_at();

DROP TRIGGER IF EXISTS trigger_update_sequences_updated_at ON sequences;
CREATE TRIGGER trigger_update_sequences_updated_at
  BEFORE UPDATE ON sequences
  FOR EACH ROW
  EXECUTE FUNCTION update_messaging_updated_at();

DROP TRIGGER IF EXISTS trigger_update_sequence_enrollments_updated_at ON sequence_enrollments;
CREATE TRIGGER trigger_update_sequence_enrollments_updated_at
  BEFORE UPDATE ON sequence_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_messaging_updated_at();

DROP TRIGGER IF EXISTS trigger_update_messages_outbound_updated_at ON messages_outbound;
CREATE TRIGGER trigger_update_messages_outbound_updated_at
  BEFORE UPDATE ON messages_outbound
  FOR EACH ROW
  EXECUTE FUNCTION update_messaging_updated_at();

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to stop sequence enrollment
CREATE OR REPLACE FUNCTION stop_sequence_enrollment(
  enrollment_id_param UUID,
  reason TEXT,
  actor_id_param UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE sequence_enrollments
  SET 
    status = 'stopped',
    stopped_at = NOW(),
    stop_reason = reason,
    updated_at = NOW()
  WHERE id = enrollment_id_param
    AND status = 'active';
    
  -- Cancel any queued messages for this enrollment
  UPDATE messages_outbound
  SET 
    status = 'failed',
    error_message = 'Sequence stopped: ' || reason,
    updated_at = NOW()
  WHERE enrollment_id = enrollment_id_param
    AND status IN ('queued', 'sending');
END;
$$;

GRANT EXECUTE ON FUNCTION stop_sequence_enrollment(UUID, TEXT, UUID) TO authenticated;

-- Function to check and process inbound messages for stop rules
CREATE OR REPLACE FUNCTION process_inbound_for_stop_rules()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inbound_record RECORD;
  enrollment_record RECORD;
  stop_on_reply TEXT;
BEGIN
  -- Process unprocessed inbound messages
  FOR inbound_record IN
    SELECT * FROM messages_inbound
    WHERE processed = false
    ORDER BY created_at ASC
  LOOP
    -- Try to match to an enrollment by email or phone
    SELECT * INTO enrollment_record
    FROM sequence_enrollments
    WHERE status = 'active'
      AND (
        (recipient_email IS NOT NULL AND inbound_record.sender_email = recipient_email)
        OR (recipient_phone IS NOT NULL AND inbound_record.sender_phone = recipient_phone)
      )
    ORDER BY started_at DESC
    LIMIT 1;
    
    -- If matched, check stop rules
    IF enrollment_record IS NOT NULL THEN
      -- Update inbound message with matched enrollment
      UPDATE messages_inbound
      SET 
        matched_enrollment_id = enrollment_record.id,
        updated_at = NOW()
      WHERE id = inbound_record.id;
      
      -- Check if sequence should stop on reply
      SELECT stop_rules->>'on_reply' INTO stop_on_reply
      FROM sequences
      WHERE id = enrollment_record.sequence_id;
      
      -- If stop on reply is enabled, stop the enrollment
      IF stop_on_reply = 'true' THEN
        PERFORM stop_sequence_enrollment(enrollment_record.id, 'reply', NULL);
        
        -- Mark the outbound message that was replied to as 'replied'
        UPDATE messages_outbound
        SET 
          status = 'replied',
          replied_at = inbound_record.created_at,
          updated_at = NOW()
        WHERE enrollment_id = enrollment_record.id
          AND status IN ('sent', 'delivered')
          AND channel = inbound_record.channel
        ORDER BY sent_at DESC
        LIMIT 1;
      END IF;
    END IF;
    
    -- Mark as processed
    UPDATE messages_inbound
    SET processed = true
    WHERE id = inbound_record.id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION process_inbound_for_stop_rules() TO authenticated;

-- Function to enqueue next sequence step
CREATE OR REPLACE FUNCTION enqueue_next_sequence_step(
  enrollment_id_param UUID
)
RETURNS UUID -- Returns message_id of queued message
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  enrollment_record RECORD;
  sequence_record RECORD;
  next_step RECORD;
  template_record RECORD;
  message_id UUID;
  scheduled_time TIMESTAMPTZ;
  rendered_body TEXT;
  rendered_subject TEXT;
BEGIN
  -- Get enrollment
  SELECT * INTO enrollment_record
  FROM sequence_enrollments
  WHERE id = enrollment_id_param
    AND status = 'active';
    
  IF enrollment_record IS NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment not found or not active';
  END IF;
  
  -- Get sequence
  SELECT * INTO sequence_record
  FROM sequences
  WHERE id = enrollment_record.sequence_id
    AND is_active = true;
    
  IF sequence_record IS NOT FOUND THEN
    RAISE EXCEPTION 'Sequence not found or not active';
  END IF;
  
  -- Get next step
  SELECT * INTO next_step
  FROM sequence_steps
  WHERE sequence_id = enrollment_record.sequence_id
    AND step_order > enrollment_record.current_step_order
    AND is_active = true
  ORDER BY step_order ASC
  LIMIT 1;
  
  -- If no next step, mark enrollment as completed
  IF next_step IS NOT FOUND THEN
    UPDATE sequence_enrollments
    SET 
      status = 'completed',
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = enrollment_id_param;
    RETURN NULL;
  END IF;
  
  -- Get template
  SELECT * INTO template_record
  FROM message_templates
  WHERE id = next_step.template_id
    AND is_active = true;
    
  IF template_record IS NOT FOUND THEN
    RAISE EXCEPTION 'Template not found or not active';
  END IF;
  
  -- Calculate scheduled time (delay from now or from last message)
  scheduled_time := NOW() + (next_step.delay_days || ' days')::interval + (next_step.delay_hours || ' hours')::interval;
  
  -- Get default provider for this channel will be fetched in INSERT
  
  -- Render template (simplified - actual implementation would use a template engine)
  -- For now, we'll store the template_id and render on send
  rendered_body := template_record.body;
  rendered_subject := template_record.subject;
  
  -- Create outbound message
  INSERT INTO messages_outbound (
    enrollment_id,
    step_id,
    channel,
    provider_id,
    recipient_email,
    recipient_phone,
    recipient_name,
    subject,
    body,
    template_id,
    status,
    scheduled_for
  ) VALUES (
    enrollment_id_param,
    next_step.id,
    template_record.channel,
    (SELECT id FROM message_providers 
     WHERE (type = 'email' AND template_record.channel = 'email') 
        OR (type = 'sms' AND template_record.channel = 'sms')
     AND enabled = true 
     AND is_default = true 
     LIMIT 1),
    enrollment_record.recipient_email,
    enrollment_record.recipient_phone,
    enrollment_record.recipient_name,
    rendered_subject,
    rendered_body,
    template_record.id,
    'queued',
    scheduled_time
  ) RETURNING id INTO message_id;
  
  -- Update enrollment current step
  UPDATE sequence_enrollments
  SET 
    current_step_order = next_step.step_order,
    updated_at = NOW()
  WHERE id = enrollment_id_param;
  
  RETURN message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION enqueue_next_sequence_step(UUID) TO authenticated;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE message_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages_outbound ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages_inbound ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_audit_log ENABLE ROW LEVEL SECURITY;

-- Basic policies (admins can see all, users can see their own)
-- Note: Adjust based on your permission model

-- Message providers: Only admins can view/edit
CREATE POLICY "Admins can manage message providers" ON message_providers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Templates: All authenticated users can view active, admins can manage
CREATE POLICY "Users can view active templates" ON message_templates
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage templates" ON message_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Sequences: All authenticated users can view active, admins can manage
CREATE POLICY "Users can view active sequences" ON sequences
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage sequences" ON sequences
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Sequence steps: Same as sequences
CREATE POLICY "Users can view active sequence steps" ON sequence_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sequences
      WHERE id = sequence_steps.sequence_id AND is_active = true
    )
  );

CREATE POLICY "Admins can manage sequence steps" ON sequence_steps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Enrollments: Users can view/manage their own, admins can see all
CREATE POLICY "Users can view their enrollments" ON sequence_enrollments
  FOR SELECT USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can create enrollments" ON sequence_enrollments
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their enrollments" ON sequence_enrollments
  FOR UPDATE USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Outbound messages: Users can view their own
CREATE POLICY "Users can view their messages" ON messages_outbound
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sequence_enrollments
      WHERE id = messages_outbound.enrollment_id
        AND (
          created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
          )
        )
    )
  );

-- Inbound messages: Users can view messages to their enrollments
CREATE POLICY "Users can view inbound messages" ON messages_inbound
  FOR SELECT USING (
    matched_enrollment_id IS NULL
    OR EXISTS (
      SELECT 1 FROM sequence_enrollments
      WHERE id = messages_inbound.matched_enrollment_id
        AND (
          created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
          )
        )
    )
  );

-- Audit log: Users can view for their messages
CREATE POLICY "Users can view audit logs" ON message_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages_outbound
      WHERE id = message_audit_log.message_id
        AND EXISTS (
          SELECT 1 FROM sequence_enrollments
          WHERE id = messages_outbound.enrollment_id
            AND (
              created_by = auth.uid()
              OR EXISTS (
                SELECT 1 FROM user_profiles
                WHERE id = auth.uid() AND role = 'admin'
              )
            )
        )
    )
  );

-- ============================================
-- CRON JOBS
-- ============================================

-- Schedule job to process queued messages (runs every 5 minutes)
SELECT cron.schedule(
  'process-queued-messages',
  '*/5 * * * *', -- Every 5 minutes
  $$
  -- This will call the Edge Function to process queued messages
  -- The actual processing happens in the Edge Function
  SELECT 1;
  $$
);

-- Schedule job to check stop rules (runs every minute)
SELECT cron.schedule(
  'process-inbound-stop-rules',
  '* * * * *', -- Every minute
  $$
  SELECT process_inbound_for_stop_rules();
  $$
);

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default email provider (Resend) if it exists in env
-- Note: This will be set up via Edge Function secrets in practice

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE message_providers IS 'Messaging provider configurations (Resend, Twilio, Quo, etc.)';
COMMENT ON TABLE message_templates IS 'Reusable message templates organized by vertical and objection type';
COMMENT ON TABLE sequences IS 'Multi-step follow-up sequences';
COMMENT ON TABLE sequence_steps IS 'Individual steps within a sequence';
COMMENT ON TABLE sequence_enrollments IS 'Links sequences to entities (sites/deals, bookings, etc.)';
COMMENT ON TABLE messages_outbound IS 'All outbound messages sent via email/SMS';
COMMENT ON TABLE messages_inbound IS 'Records inbound messages for stop rule processing';
COMMENT ON TABLE message_audit_log IS 'Comprehensive audit log for all messaging activities';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MESSAGING & SEQUENCES SCHEMA CREATED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Tables Created:';
  RAISE NOTICE '   • message_providers';
  RAISE NOTICE '   • message_templates';
  RAISE NOTICE '   • sequences';
  RAISE NOTICE '   • sequence_steps';
  RAISE NOTICE '   • sequence_enrollments';
  RAISE NOTICE '   • messages_outbound';
  RAISE NOTICE '   • messages_inbound';
  RAISE NOTICE '   • message_audit_log';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '   1. Deploy messaging Edge Functions';
  RAISE NOTICE '   2. Configure message providers';
  RAISE NOTICE '   3. Create message templates';
  RAISE NOTICE '   4. Set up inbound webhooks';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
