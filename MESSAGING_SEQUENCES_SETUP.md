# Messaging & Sequences System - Setup Guide

## Overview

This system implements a complete messaging layer with follow-up sequences:
- **SMS and Email** outbound sending with provider abstraction
- **Inbound message** ingestion and recording
- **Template library** organized by vertical and objection type
- **Stage-based sequences** with stop rules
- **Comprehensive audit logging**

## Architecture

### Database Schema

The system uses the following tables:
- `message_providers` - Provider configurations (Resend, Twilio, Quo, etc.)
- `message_templates` - Reusable message templates
- `sequences` - Multi-step follow-up sequences
- `sequence_steps` - Individual steps within sequences
- `sequence_enrollments` - Links sequences to entities (sites/deals, bookings, etc.)
- `messages_outbound` - All outbound messages (email/SMS)
- `messages_inbound` - Inbound messages for stop rule processing
- `message_audit_log` - Comprehensive audit trail

### Edge Functions

1. **send-message** - Sends queued messages via provider abstraction
2. **process-sequence-steps** - Processes queued messages and enqueues next steps (called by cron)
3. **receive-inbound-message** - Handles inbound webhooks from providers

## Setup Instructions

### Step 1: Create Database Schema

Run the SQL file in your Supabase SQL Editor:

```bash
# File: ADD_MESSAGING_AND_SEQUENCES_SCHEMA.sql
```

This creates all tables, functions, triggers, and cron jobs.

### Step 2: Deploy Edge Functions

Deploy the three Edge Functions:

```bash
cd supabase/functions

# Deploy send-message function
supabase functions deploy send-message

# Deploy process-sequence-steps function
supabase functions deploy process-sequence-steps

# Deploy receive-inbound-message function
supabase functions deploy receive-inbound-message
```

### Step 3: Configure Message Providers

Set up your messaging providers in the `message_providers` table:

#### Email Provider (Resend)

```sql
INSERT INTO message_providers (name, type, enabled, is_default, config)
VALUES (
  'resend',
  'email',
  true,
  true,
  '{"api_key": "YOUR_RESEND_API_KEY", "from_email": "NFG <onboarding@resend.dev>"}'::jsonb
);
```

Or set via Edge Function secrets:
```bash
supabase secrets set RESEND_API_KEY=re_your_key_here
supabase secrets set RESEND_FROM_EMAIL="NFG <onboarding@resend.dev>"
```

#### SMS Provider (Twilio)

```sql
INSERT INTO message_providers (name, type, enabled, is_default, config)
VALUES (
  'twilio',
  'sms',
  true,
  true,
  '{"account_sid": "YOUR_ACCOUNT_SID", "auth_token": "YOUR_AUTH_TOKEN", "from_number": "+1234567890"}'::jsonb
);
```

Or set via Edge Function secrets:
```bash
supabase secrets set TWILIO_ACCOUNT_SID=your_account_sid
supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token
supabase secrets set TWILIO_FROM_NUMBER=+1234567890
```

#### SMS Provider (Quo)

```sql
INSERT INTO message_providers (name, type, enabled, is_default, config)
VALUES (
  'quo',
  'sms',
  true,
  false,
  '{"api_key": "YOUR_QUO_API_KEY", "from_number": "+1234567890"}'::jsonb
);
```

### Step 4: Load Templates and Sequences

Import templates and sequences from `message-templates.json`:

```javascript
// Use the admin UI or run this script
import { createTemplate } from './js/messaging-sequences.js'

const templates = require('./message-templates.json')

for (const template of templates.templates) {
  await createTemplate({
    name: template.name,
    description: template.description,
    vertical: template.vertical,
    objectionType: template.objection_type,
    channel: template.channel,
    subject: template.subject,
    body: template.body,
    variables: template.variables,
  })
}
```

### Step 5: Set Up Inbound Webhooks

#### Twilio Webhook

In your Twilio Console:
1. Go to Phone Numbers → Manage → Active Numbers
2. Select your number
3. Set "A Message Comes In" webhook URL to:
   ```
   https://YOUR_PROJECT.supabase.co/functions/v1/receive-inbound-message
   ```

#### Quo Webhook

Configure Quo webhooks to point to:
```
https://YOUR_PROJECT.supabase.co/functions/v1/receive-inbound-message
```

### Step 6: Update Cron Job

The schema creates cron jobs, but you may need to update the function URL:

```sql
-- Update the cron job to call your Edge Function
SELECT cron.schedule(
  'process-queued-messages',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/process-sequence-steps',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## Usage

### Attach Sequence to a Site/Deal

```javascript
import { attachSequenceToSite } from './js/messaging-sequences.js'

// Attach a sequence to a site
await attachSequenceToSite(
  siteId, // BIGINT site ID
  sequenceId, // UUID sequence ID
  {
    recipientEmail: 'client@example.com',
    recipientPhone: '+1234567890',
    recipientName: 'John Doe',
  }
)
```

### Manually Enroll in Sequence

```javascript
import { enrollInSequence } from './js/messaging-sequences.js'

await enrollInSequence(
  sequenceId,
  'site', // entity type
  siteId.toString(), // entity ID
  {
    recipientEmail: 'client@example.com',
    recipientPhone: '+1234567890',
    recipientName: 'John Doe',
    metadata: { custom_field: 'value' },
  }
)
```

### Pause/Resume/Stop Sequence

```javascript
import { pauseSequence, resumeSequence, stopSequence } from './js/messaging-sequences.js'

// Pause an enrollment
await pauseSequence(enrollmentId)

// Resume a paused enrollment
await resumeSequence(enrollmentId)

// Stop an enrollment
await stopSequence(enrollmentId, 'manual')
```

### Check Active Sequences

```javascript
import { getEntityEnrollments, hasActiveSequence } from './js/messaging-sequences.js'

// Check if site has active sequence
const hasActive = await hasActiveSequence('site', siteId.toString())

// Get all enrollments for an entity
const { enrollments } = await getEntityEnrollments('site', siteId.toString())
```

## Stop Rules

Sequences stop automatically when:

1. **On Reply**: If `stop_rules.on_reply = true` and recipient replies
2. **On Stage Change**: If entity changes to a specified stage (configured in `stop_rules.on_stage_change`)
3. **Manual**: When manually paused or stopped via API

## Template Variables

Templates support the following variables (automatically populated):

- `{{name}}` - Recipient name
- `{{recipient_name}}` - Same as name
- `{{site_name}}` - Site name (if entity_type = 'site')
- `{{deal_value}}` - Deal value (if available)
- `{{site_address}}` - Site address
- `{{booking_title}}` - Booking title (if entity_type = 'booking')
- Plus any custom variables in enrollment `metadata`

## Admin UI Integration

Add to your admin UI:

```html
<!-- In sites.html or deals management page -->
<script type="module">
  import { attachSequenceToSite, getEntityEnrollments } from './js/messaging-sequences.js'

  // Show "Attach Follow-up Sequence" button on site detail page
  const attachSequenceBtn = document.getElementById('attach-sequence-btn')
  attachSequenceBtn?.addEventListener('click', async () => {
    const sequenceId = document.getElementById('sequence-select').value
    const siteId = getCurrentSiteId() // Your function to get current site ID
    
    await attachSequenceToSite(siteId, sequenceId, {
      recipientEmail: document.getElementById('client-email').value,
      recipientPhone: document.getElementById('client-phone').value,
      recipientName: document.getElementById('client-name').value,
    })
    
    alert('Follow-up sequence attached!')
  })

  // Display active sequences
  async function loadActiveSequences(siteId) {
    const { enrollments } = await getEntityEnrollments('site', siteId.toString())
    // Display in UI
  }
</script>
```

## Testing

Run the test suite:

```bash
# Tests are in tests/messaging-sequences.test.js
# Use your preferred test runner (Jest, Mocha, etc.)
npm test tests/messaging-sequences.test.js
```

## Monitoring

### View Message Status

```sql
-- View all outbound messages
SELECT * FROM messages_outbound ORDER BY created_at DESC LIMIT 50;

-- View failed messages
SELECT * FROM messages_outbound WHERE status = 'failed';

-- View active enrollments
SELECT * FROM sequence_enrollments WHERE status = 'active';
```

### View Audit Logs

```sql
-- View audit trail
SELECT * FROM message_audit_log ORDER BY created_at DESC LIMIT 100;
```

## Troubleshooting

### Messages Not Sending

1. Check provider configuration in `message_providers` table
2. Verify Edge Function secrets are set correctly
3. Check `messages_outbound` table for error messages
4. Review Edge Function logs in Supabase Dashboard

### Sequences Not Progressing

1. Verify cron job is running: `SELECT * FROM cron.job;`
2. Check `process-sequence-steps` Edge Function logs
3. Verify sequence steps are active: `SELECT * FROM sequence_steps WHERE is_active = true;`

### Stop Rules Not Working

1. Verify inbound messages are being recorded: `SELECT * FROM messages_inbound;`
2. Check `process_inbound_for_stop_rules()` function is being called by cron
3. Verify sequence `stop_rules` are configured correctly

## Security Notes

- All tables have Row Level Security (RLS) enabled
- Only admins can manage providers and templates
- Users can only view/manage their own enrollments
- Service role key is required for Edge Functions (kept secure)

## Next Steps

1. Create custom templates for your verticals
2. Set up sequences tailored to your sales process
3. Integrate with your existing site/deal management UI
4. Configure inbound webhooks for reply detection
5. Monitor message delivery and engagement

For questions or issues, refer to the code comments or create an issue.
