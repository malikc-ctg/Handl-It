# Quo Call Tracker Integration

## Overview

The Quo integration enables automatic call tracking, linking calls to sites (leads/deals), and provides click-to-call functionality. Calls are automatically synced from Quo via webhooks and appear in the app's timeline.

## Features

- ✅ **Webhook Integration**: Receives call events from Quo
- ✅ **Automatic Call Linking**: Links calls to sites by phone number or Quo contact mapping
- ✅ **Phone Number Normalization**: Converts phone numbers to E.164 format
- ✅ **Click-to-Call**: Launch calls from the app into Quo
- ✅ **Post-Call Workflow**: Automatic summary generation, objection tagging, and next action suggestions
- ✅ **Consent Gating**: Respects consent flags for transcripts and recordings
- ✅ **Idempotency**: Prevents duplicate call records
- ✅ **Webhook Signature Verification**: Secures webhook endpoints

## Setup

### 1. Database Schema

Run the SQL migration to create the necessary tables:

```bash
# In Supabase SQL Editor
# Run: ADD_QUO_CALLS_SCHEMA.sql
```

This creates:
- `calls` - Main call records
- `quo_webhook_logs` - Webhook payload storage (90-day retention)
- `quo_contact_mappings` - Maps Quo contacts to sites
- `call_events` - Audit log for call-related events

### 2. Environment Variables

Set the following secrets in Supabase:

```bash
supabase secrets set QUO_API_KEY="your-quo-api-key"
supabase secrets set QUO_WEBHOOK_SECRET="your-webhook-secret"
```

### 3. Deploy Edge Functions

Deploy the webhook handler and post-call workflow processor:

```bash
supabase functions deploy quo-webhook
supabase functions deploy quo-post-call-workflow
```

### 4. Configure Webhook in Quo

1. Go to Quo dashboard → Settings → Webhooks
2. Add webhook URL: `https://your-project.supabase.co/functions/v1/quo-webhook`
3. Select events to subscribe to:
   - `call.started`
   - `call.answered`
   - `call.completed`
   - `call.transcript`
   - `call.recording`
4. Set webhook secret (must match `QUO_WEBHOOK_SECRET`)
5. Save webhook configuration

## Usage

### Phone Number Normalization

Phone numbers are automatically normalized to E.164 format:

```javascript
import { normalizePhoneNumber, formatPhoneNumber } from './js/integrations/quo.js'

// Normalize to E.164
const normalized = normalizePhoneNumber('(416) 555-1234')
// Returns: '+14165551234'

// Format for display
const formatted = formatPhoneNumber('+14165551234')
// Returns: '(416) 555-1234'
```

### Click-to-Call

Add click-to-call buttons to your UI:

```javascript
import { createClickToCallButton } from './js/integrations/quo-ui.js'

// Create a button
const button = createClickToCallButton('+14165551234', {
  siteId: 123,
  siteName: 'Acme Corp',
  buttonText: 'Call Now'
})

// Add to DOM
document.getElementById('call-button-container').appendChild(button)
```

Or use the utility function directly:

```javascript
import { initiateClickToCall } from './js/integrations/quo.js'

await initiateClickToCall('+14165551234', {
  siteId: 123,
  siteName: 'Acme Corp'
})
```

### Displaying Calls Timeline

Show calls for a site:

```javascript
import { renderCallsTimeline } from './js/integrations/quo-ui.js'

// Render calls for a site
await renderCallsTimeline(siteId, 'calls-timeline-container')
```

### Manual Call Linking

If a call needs review (multiple site matches), manually link it:

```javascript
import { manuallyLinkCall } from './js/integrations/quo.js'

const { data: { user } } = await supabase.auth.getUser()
await manuallyLinkCall(callId, siteId, user.id)
```

### Quo Contact Mapping

Map Quo contacts to sites for automatic linking:

```javascript
import { mapQuoContactToSite } from './js/integrations/quo.js'

const { data: { user } } = await supabase.auth.getUser()
await mapQuoContactToSite('quo-contact-123', siteId, user.id, '+14165551234')
```

## Call Linking Logic

Calls are linked to sites in the following priority order:

1. **Internal Reference**: If webhook contains `metadata.site_id`, use it directly
2. **Quo Contact Mapping**: If `quo_contact_id` exists in `quo_contact_mappings`, use mapped site
3. **Phone Number Match**: Match normalized phone numbers against `sites.contact_phone`
   - If multiple matches found, link to most recent active site and flag `needs_review = true`
   - If single match, link automatically
   - If no match, leave `site_id = null`

## Post-Call Workflow

When a call is completed and has a transcript, the post-call workflow automatically:

1. **Generates Summary**: Creates a brief summary from the transcript
2. **Extracts Objection Tags**: Identifies common objections (price, competitor, scheduling, etc.)
3. **Suggests Next Action**: Recommends follow-up actions based on call outcome and objections

To trigger post-call workflow processing:

```javascript
// Call the Edge Function
const response = await fetch(
  'https://your-project.supabase.co/functions/v1/quo-post-call-workflow',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceRoleKey}`
    },
    body: JSON.stringify({ callId: 'call-uuid' })
  }
)
```

Or set up a database trigger to automatically process calls when transcript is received.

## Consent Gating

The integration respects consent flags for transcripts and recordings:

- If `consent = true` in webhook: Store transcript and recording URL
- If `consent = false` in webhook: Store only metadata, drop transcript/recording
- Audit event is logged when consent is denied

## Webhook Events

The integration handles the following Quo webhook events:

- `call.started` - Call initiated
- `call.answered` - Call answered
- `call.completed` - Call ended
- `call.transcript` - Transcript available
- `call.recording` - Recording available

### Webhook Payload Format

Expected webhook payload structure:

```json
{
  "event_type": "call.completed",
  "call_id": "quo-call-123",
  "contact_id": "quo-contact-456",
  "direction": "inbound",
  "from_number": "4165551234",
  "to_number": "14165551234",
  "started_at": "2025-01-15T10:00:00Z",
  "answered_at": "2025-01-15T10:00:05Z",
  "ended_at": "2025-01-15T10:05:00Z",
  "duration": 300,
  "state": "completed",
  "outcome": "answered",
  "transcript": "Call transcript text...",
  "summary": "AI-generated summary...",
  "consent": true,
  "recording_url": "https://...",
  "metadata": {
    "site_id": 123
  }
}
```

## Idempotency

Webhooks are idempotent based on `quo_call_id`. If the same webhook is received multiple times:

- First receipt: Creates new call record
- Subsequent receipts: Updates existing call record with new data

## Webhook Logs

All webhook payloads are stored in `quo_webhook_logs` for debugging:

- Retention: 90 days (processed logs are automatically cleaned up)
- Includes: Full payload, signature, processing status, errors
- Access: Service role only (for security)

## Testing

### Unit Tests

Run phone normalization tests:

```javascript
import { runTests } from './js/integrations/__tests__/quo.test.js'
runTests()
```

### Integration Tests

Test webhook ingestion:

```typescript
import { testWebhookPayloads, validateWebhookPayload } from './supabase/functions/quo-webhook/__tests__/webhook.test.ts'

// Validate payload structure
const validation = validateWebhookPayload(testWebhookPayloads.callStarted)
console.log(validation) // { valid: true, errors: [] }
```

## Troubleshooting

### Calls Not Appearing

1. Check webhook logs in `quo_webhook_logs` table
2. Verify webhook URL is correct in Quo dashboard
3. Check webhook signature verification (if enabled)
4. Review Edge Function logs: `supabase functions logs quo-webhook`

### Calls Not Linking to Sites

1. Verify phone numbers are normalized correctly
2. Check `sites.contact_phone` format matches normalized numbers
3. Review calls with `needs_review = true` for manual linking
4. Create Quo contact mappings for better linking

### Transcripts Not Stored

1. Verify `consent = true` in webhook payload
2. Check `has_consent` flag in call record
3. Review audit events for consent denials

## API Reference

### JavaScript Functions

#### `normalizePhoneNumber(phone, defaultCountryCode)`
Normalizes phone number to E.164 format.

#### `formatPhoneNumber(phone)`
Formats E.164 number for display.

#### `linkCallToSite(callData)`
Links a call to a site by phone number or Quo contact.

#### `initiateClickToCall(phoneNumber, options)`
Initiates click-to-call via Quo.

#### `getCallsForSite(siteId, options)`
Fetches calls for a site.

#### `manuallyLinkCall(callId, siteId, userId)`
Manually links a call to a site.

#### `mapQuoContactToSite(quoContactId, siteId, userId, phoneNumber)`
Maps a Quo contact to a site.

### Edge Functions

#### `quo-webhook`
- **URL**: `/functions/v1/quo-webhook`
- **Method**: POST
- **Auth**: Webhook signature verification
- **Purpose**: Receives and processes Quo webhooks

#### `quo-post-call-workflow`
- **URL**: `/functions/v1/quo-post-call-workflow`
- **Method**: POST
- **Auth**: Service role key
- **Purpose**: Processes post-call workflow (summary, objections, next actions)

## Security Considerations

1. **Webhook Signatures**: Always verify webhook signatures in production
2. **RLS Policies**: Calls are protected by Row Level Security
3. **Consent**: Transcripts/recordings only stored with explicit consent
4. **Service Role**: Edge Functions use service role key (keep secure)

## Future Enhancements

- [ ] AI-powered summary generation (OpenAI/Anthropic integration)
- [ ] Automatic task creation from next action suggestions
- [ ] Call analytics and reporting
- [ ] Real-time call notifications
- [ ] Call recording playback in UI
- [ ] Integration with CRM systems

## Support

For issues or questions:
1. Check webhook logs in database
2. Review Edge Function logs
3. Verify environment variables are set
4. Test with sample webhook payloads

---

**Last Updated**: January 2025
**Version**: 1.0.0
