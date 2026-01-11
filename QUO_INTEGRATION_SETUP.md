# Quo Integration Quick Setup Guide

## Prerequisites

- Supabase project configured
- Supabase CLI installed and logged in
- Quo account with API access

## Step 1: Database Setup

Run the SQL migrations in Supabase SQL Editor:

1. **Create tables**: Run `ADD_QUO_CALLS_SCHEMA.sql`
2. **Optional - Auto workflow**: Run `ADD_QUO_POST_CALL_TRIGGER.sql` (requires pg_net extension)

## Step 2: Set Environment Variables

```bash
# Set Quo API key (if needed for API calls)
supabase secrets set QUO_API_KEY="your-quo-api-key"

# Set webhook secret (must match Quo dashboard)
supabase secrets set QUO_WEBHOOK_SECRET="your-webhook-secret"
```

## Step 3: Deploy Edge Functions

```bash
# Deploy webhook handler
supabase functions deploy quo-webhook

# Deploy post-call workflow processor
supabase functions deploy quo-post-call-workflow
```

## Step 4: Configure Quo Webhook

1. Log in to Quo dashboard
2. Go to Settings → Webhooks
3. Add new webhook:
   - **URL**: `https://zqcbldgheimqrnqmbbed.supabase.co/functions/v1/quo-webhook`
   - **Events**: Select all call-related events
   - **Secret**: Use the same value as `QUO_WEBHOOK_SECRET`
4. Save webhook

## Step 5: Test Integration

### Test Webhook

Send a test webhook payload:

```bash
curl -X POST https://zqcbldgheimqrnqmbbed.supabase.co/functions/v1/quo-webhook \
  -H "Content-Type: application/json" \
  -H "x-quo-signature: test-signature" \
  -d '{
    "event_type": "call.completed",
    "call_id": "test-call-123",
    "direction": "inbound",
    "from_number": "4165551234",
    "to_number": "14165551235",
    "started_at": "2025-01-15T10:00:00Z",
    "ended_at": "2025-01-15T10:05:00Z",
    "outcome": "answered"
  }'
```

### Verify in Database

```sql
-- Check if call was created
SELECT * FROM calls WHERE quo_call_id = 'test-call-123';

-- Check webhook logs
SELECT * FROM quo_webhook_logs ORDER BY created_at DESC LIMIT 5;
```

## Step 6: Add UI Components

### In your HTML page (e.g., sites.html):

```html
<!-- Add calls timeline section -->
<div id="calls-timeline" class="mt-6">
  <!-- Calls will be rendered here -->
</div>

<!-- Add click-to-call button -->
<button id="call-button" class="px-4 py-2 bg-blue-600 text-white rounded">
  Call
</button>
```

### In your JavaScript:

```javascript
// Import Quo integration
import { renderCallsTimeline, createClickToCallButton } from './js/integrations/quo-ui.js'
import { initiateClickToCall } from './js/integrations/quo.js'

// Render calls for a site
const siteId = 123
await renderCallsTimeline(siteId, 'calls-timeline')

// Add click-to-call button
const phoneNumber = '+14165551234'
const button = createClickToCallButton(phoneNumber, {
  siteId: siteId,
  siteName: 'Site Name'
})
document.getElementById('call-button').replaceWith(button)
```

## Verification Checklist

- [ ] Database tables created (`calls`, `quo_webhook_logs`, etc.)
- [ ] Environment variables set (`QUO_API_KEY`, `QUO_WEBHOOK_SECRET`)
- [ ] Edge Functions deployed (`quo-webhook`, `quo-post-call-workflow`)
- [ ] Webhook configured in Quo dashboard
- [ ] Test webhook received successfully
- [ ] Call record created in database
- [ ] Phone numbers normalized correctly
- [ ] Calls linking to sites (if phone matches)
- [ ] UI components displaying calls

## Troubleshooting

### Webhook not receiving events

1. Check Quo dashboard → Webhooks → Delivery logs
2. Check Edge Function logs: `supabase functions logs quo-webhook`
3. Verify webhook URL is correct
4. Check webhook secret matches

### Calls not linking to sites

1. Verify phone numbers in `sites.contact_phone` are in correct format
2. Check `calls.needs_review = true` for manual review
3. Create Quo contact mappings for better linking

### Post-call workflow not running

1. Verify Edge Function is deployed
2. Check if call has transcript or summary
3. Manually trigger: `POST /functions/v1/quo-post-call-workflow` with `{ "callId": "..." }`

## Next Steps

1. **Map Quo Contacts**: Create mappings for better call linking
2. **Customize Workflow**: Adjust objection tags and next actions
3. **Add AI Integration**: Connect OpenAI/Anthropic for better summaries
4. **Create Tasks**: Integrate next action suggestions with task system

## Support

For detailed documentation, see: `/docs/INTEGRATIONS_QUO.md`
