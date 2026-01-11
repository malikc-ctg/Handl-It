-- ============================================
-- Seed Messaging & Sequences Data
-- ============================================
-- Populates initial templates and sequences
-- Run this after creating the schema
-- ============================================

-- ============================================
-- INSERT DEFAULT EMAIL PROVIDER (Resend)
-- ============================================
-- Note: Update with your actual Resend API key or set via Edge Function secrets
INSERT INTO message_providers (name, type, enabled, is_default, config)
VALUES (
  'resend',
  'email',
  true,
  true,
  '{"from_email": "NFG <onboarding@resend.dev>"}'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- INSERT TEMPLATES
-- ============================================

-- Welcome Email - Facilities
INSERT INTO message_templates (name, description, vertical, objection_type, channel, subject, body, variables, is_active)
VALUES (
  'Welcome Email - Facilities',
  'Initial welcome email for new facilities management leads',
  'facilities',
  NULL,
  'email',
  'Welcome to Northern Facilities Group - {{site_name}}',
  'Hello {{name}},

Thank you for your interest in facilities management services for {{site_name}}.

We specialize in comprehensive facilities management solutions, including:

• Cleaning and maintenance services
• Emergency response
• Site inspections and reporting
• Inventory management

Based on your site details, we''ve prepared a customized proposal for your review.

Would you be available for a brief call this week to discuss how we can help streamline your facilities operations?

Best regards,
Northern Facilities Group Team',
  '["name", "site_name", "deal_value"]'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- Follow-up - Price Objection
INSERT INTO message_templates (name, description, vertical, objection_type, channel, subject, body, variables, is_active)
VALUES (
  'Follow-up - Price Objection',
  'Follow-up email addressing pricing concerns',
  'facilities',
  'price',
  'email',
  'Re: Facilities Management Quote - Value for {{site_name}}',
  'Hi {{name}},

I understand that pricing is an important consideration for {{site_name}}.

I''d like to highlight the value our facilities management services provide:

• Reduced operational costs through preventive maintenance
• Improved compliance and reduced risk
• 24/7 emergency response
• Real-time reporting and transparency

We''re happy to work within your budget. Would you be open to discussing a phased approach or custom package that fits your needs?

I''m available for a quick call to explore options that work for both parties.

Best regards,
Northern Facilities Group',
  '["name", "site_name", "deal_value"]'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- Follow-up - Timing Objection
INSERT INTO message_templates (name, description, vertical, objection_type, channel, subject, body, variables, is_active)
VALUES (
  'Follow-up - Timing Objection',
  'Follow-up email addressing timing concerns',
  'facilities',
  'timing',
  'email',
  'Re: Getting Started - Flexible Timeline Options',
  'Hi {{name}},

I understand that timing is important for {{site_name}}.

The good news is that we can work with your schedule. Our onboarding process is flexible and can be tailored to your timeline:

• Quick start: We can begin within 2 weeks
• Phased approach: Start with priority areas, expand gradually
• Custom timeline: We''ll adjust to fit your needs

What timeline were you thinking? I''d be happy to discuss options that work for you.

Best regards,
Northern Facilities Group',
  '["name", "site_name"]'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- Follow-up - Quality Objection
INSERT INTO message_templates (name, description, vertical, objection_type, channel, subject, body, variables, is_active)
VALUES (
  'Follow-up - Quality Objection',
  'Follow-up email addressing quality concerns',
  'facilities',
  'quality',
  'email',
  'Re: Quality Assurance at Northern Facilities Group',
  'Hi {{name}},

Quality is our top priority, and I wanted to share how we ensure exceptional service:

• Certified and trained staff
• Quality inspections and audits
• Real-time reporting with photo documentation
• Client satisfaction guarantee
• References from similar facilities available

We''d be happy to arrange a site visit or connect you with references. Would that be helpful?

Best regards,
Northern Facilities Group',
  '["name", "site_name"]'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- Final Follow-up Email
INSERT INTO message_templates (name, description, vertical, objection_type, channel, subject, body, variables, is_active)
VALUES (
  'Final Follow-up Email',
  'Final follow-up before closing sequence',
  'facilities',
  NULL,
  'email',
  'Last Chance: Facilities Management for {{site_name}}',
  'Hi {{name}},

This will be my last follow-up regarding facilities management services for {{site_name}}.

I wanted to make sure you had everything you need to make a decision. If you have any questions or concerns, I''m here to help.

If now isn''t the right time, no problem. Feel free to reach out when you''re ready to discuss.

Best regards,
Northern Facilities Group',
  '["name", "site_name"]'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- Welcome SMS
INSERT INTO message_templates (name, description, vertical, objection_type, channel, subject, body, variables, is_active)
VALUES (
  'Welcome SMS',
  'Initial SMS welcome for new leads',
  'facilities',
  NULL,
  'sms',
  NULL,
  'Hi {{name}}, thanks for your interest in NFG facilities management for {{site_name}}. We''ll send a detailed proposal shortly. Questions? Reply to this message!',
  '["name", "site_name"]'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- Follow-up SMS - Quick Check
INSERT INTO message_templates (name, description, vertical, objection_type, channel, subject, body, variables, is_active)
VALUES (
  'Follow-up SMS - Quick Check',
  'Quick SMS follow-up',
  'facilities',
  NULL,
  'sms',
  NULL,
  'Hi {{name}}, just checking in about our proposal for {{site_name}}. Any questions? Reply anytime!',
  '["name", "site_name"]'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- ============================================
-- INSERT SEQUENCES
-- ============================================

-- Standard Follow-up Sequence - Facilities
DO $$
DECLARE
  sequence_id UUID;
  template_welcome_id UUID;
  template_sms_check_id UUID;
  template_quality_id UUID;
  template_price_id UUID;
  template_final_id UUID;
BEGIN
  -- Get template IDs
  SELECT id INTO template_welcome_id FROM message_templates WHERE name = 'Welcome Email - Facilities';
  SELECT id INTO template_sms_check_id FROM message_templates WHERE name = 'Follow-up SMS - Quick Check';
  SELECT id INTO template_quality_id FROM message_templates WHERE name = 'Follow-up - Quality Objection';
  SELECT id INTO template_price_id FROM message_templates WHERE name = 'Follow-up - Price Objection';
  SELECT id INTO template_final_id FROM message_templates WHERE name = 'Final Follow-up Email';

  -- Create sequence
  INSERT INTO sequences (name, description, vertical, is_active, stop_rules)
  VALUES (
    'Standard Follow-up Sequence - Facilities',
    '5-step follow-up sequence for facilities management leads',
    'facilities',
    true,
    '{"on_reply": true, "on_stage_change": []}'::jsonb
  )
  RETURNING id INTO sequence_id;

  -- Insert sequence steps
  IF template_welcome_id IS NOT NULL THEN
    INSERT INTO sequence_steps (sequence_id, step_order, delay_days, delay_hours, template_id, is_active)
    VALUES (sequence_id, 1, 0, 0, template_welcome_id, true);
  END IF;

  IF template_sms_check_id IS NOT NULL THEN
    INSERT INTO sequence_steps (sequence_id, step_order, delay_days, delay_hours, template_id, is_active)
    VALUES (sequence_id, 2, 3, 0, template_sms_check_id, true);
  END IF;

  IF template_quality_id IS NOT NULL THEN
    INSERT INTO sequence_steps (sequence_id, step_order, delay_days, delay_hours, template_id, is_active)
    VALUES (sequence_id, 3, 7, 0, template_quality_id, true);
  END IF;

  IF template_price_id IS NOT NULL THEN
    INSERT INTO sequence_steps (sequence_id, step_order, delay_days, delay_hours, template_id, is_active)
    VALUES (sequence_id, 4, 14, 0, template_price_id, true);
  END IF;

  IF template_final_id IS NOT NULL THEN
    INSERT INTO sequence_steps (sequence_id, step_order, delay_days, delay_hours, template_id, is_active)
    VALUES (sequence_id, 5, 30, 0, template_final_id, true);
  END IF;
END $$;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MESSAGING DATA SEEDED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Seeded:';
  RAISE NOTICE '   • Email provider (Resend)';
  RAISE NOTICE '   • 7 message templates';
  RAISE NOTICE '   • 1 standard sequence';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '   1. Update Resend API key in message_providers or set via secrets';
  RAISE NOTICE '   2. Add SMS provider (Twilio/Quo) if needed';
  RAISE NOTICE '   3. Deploy Edge Functions';
  RAISE NOTICE '   4. Set up inbound webhooks';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
