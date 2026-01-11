# Sales Portal Backend API Documentation

Complete API documentation for the Sales Portal backend services.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [API Structure](#api-structure)
- [Deals API](#deals-api)
- [Quotes API](#quotes-api)
- [Sequences API](#sequences-api)
- [Events API](#events-api)
- [Analytics API](#analytics-api)
- [Data Models](#data-models)
- [Error Handling](#error-handling)

## Overview

The Sales Portal Backend provides a comprehensive API for managing deals, quotes, follow-up sequences, events, and analytics. All services use Supabase as the backend database and follow a consistent pattern of direct Supabase client calls from JavaScript modules.

### Key Features

- **Deal Priority Queue**: Automatically calculates priority scores for deals
- **Timeline View**: Single-scroll deal view with complete activity timeline
- **Quote System**: Template-based quotes with versioning and Good/Better/Best variants
- **Follow-up Sequences**: Stage-triggered automated sequences with stop rules
- **Event Logging**: Immutable event log for all deal activities
- **Analytics**: Sales funnel analytics (calls → connections → quotes → wins)

## Authentication

All API calls require authentication via Supabase Auth. The current user is automatically retrieved from the Supabase client session.

```javascript
import { supabase } from './js/supabase.js';

// User authentication is handled automatically
// All API calls use the authenticated user's context
```

## API Structure

The API is organized into service modules that can be imported directly or through the main API interface:

```javascript
// Direct service imports
import * as dealService from './js/services/deal-service.js';
import * as quoteService from './js/services/quote-service.js';

// Or use the unified API interface
import { deals, quotes, sequences, events, analytics } from './js/api/sales-portal-api.js';
```

## Deals API

### Get Deal Queue

Get prioritized list of deals with pagination.

```javascript
const result = await deals.getQueue({
  limit: 20,        // Number of deals to return (default: 20)
  offset: 0,        // Pagination offset (default: 0)
  stage: 'prospecting',  // Filter by stage (optional)
  assignedTo: 'user-id'  // Filter by assigned user (optional)
});

// Returns:
{
  data: [
    {
      id: 'deal-uuid',
      title: 'Deal Title',
      stage: 'qualification',
      deal_value: 50000,
      priority_score: 75.5,
      last_touch_at: '2024-01-15T10:30:00Z',
      touch_count: 5,
      contact: { ... },
      site: { ... }
    }
  ],
  total: 100,
  limit: 20,
  offset: 0
}
```

### Get Deal Details

Get single deal with full details, timeline, and next actions.

```javascript
const deal = await deals.getDetails('deal-id');

// Returns:
{
  id: 'deal-uuid',
  title: 'Deal Title',
  stage: 'proposal',
  deal_value: 75000,
  contact: {
    id: 'contact-uuid',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com'
  },
  site: {
    id: 123,
    name: 'Office Building',
    address: '123 Main St'
  },
  timeline: [
    {
      id: 'event-uuid',
      type: 'event',
      event_type: 'deal_stage_changed',
      timestamp: '2024-01-15T10:00:00Z',
      description: 'Stage changed to proposal'
    },
    {
      id: 'call-uuid',
      type: 'call',
      call_type: 'outbound',
      duration_seconds: 300,
      timestamp: '2024-01-14T14:00:00Z'
    }
    // ... more timeline entries
  ],
  next_actions: [
    {
      type: 'quote',
      label: 'Send quote',
      priority: 'high',
      allowed: true
    }
  ]
}
```

### Create Deal

Create a new deal.

```javascript
const deal = await deals.create({
  title: 'New Deal',
  contact_id: 'contact-uuid',
  site_id: 123,
  stage: 'prospecting',
  deal_value: 30000,
  expected_close_date: '2024-03-01',
  notes: 'Initial contact made via referral'
});
```

### Update Deal Stage

Update a deal's stage (automatically creates event and updates touch count).

```javascript
const deal = await deals.updateStage('deal-id', 'qualification');
```

### Close Deal

Mark a deal as won or lost.

```javascript
// Mark as won
const deal = await deals.close('deal-id', 'won');

// Mark as lost
const deal = await deals.close('deal-id', 'lost');
```

### Get Deal Timeline

Get all timeline entries for a deal (events, calls, messages, quotes, visits).

```javascript
const timeline = await deals.getTimeline('deal-id');

// Returns array of timeline entries sorted by timestamp (newest first)
```

## Quotes API

### Get Quote Templates

Get quote templates, optionally filtered by vertical.

```javascript
// Get all templates
const templates = await quotes.getTemplates();

// Get templates for specific vertical
const templates = await quotes.getTemplates('commercial_cleaning');
```

### Create Quote

Create a new quote from template or scratch.

```javascript
const quote = await quotes.create({
  deal_id: 'deal-uuid',
  template_id: 'template-uuid',  // Optional
  variant: 'better',              // Optional: 'good', 'better', 'best'
  currency: 'USD',
  valid_until: '2024-02-15',
  notes: 'Initial quote',
  line_items: [
    {
      description: 'Monthly Cleaning Service',
      quantity: 1,
      unit_price: 2000,
      sequence_order: 0
    },
    {
      description: 'Window Cleaning (Quarterly)',
      quantity: 4,
      unit_price: 500,
      sequence_order: 1
    }
  ]
});

// Returns quote with calculated total_amount and line_items
```

### Create Quote Version

Create a new version of an existing quote (preserves history).

```javascript
// Create version from latest quote
const newVersion = await quotes.createVersion('deal-id');

// Create version from specific quote
const newVersion = await quotes.createVersion('deal-id', 'base-quote-id');
```

### Get Quote Details

Get quote with line items.

```javascript
const quote = await quotes.getDetails('quote-id');

// Returns:
{
  id: 'quote-uuid',
  deal_id: 'deal-uuid',
  version: 2,
  variant: 'better',
  status: 'drafted',
  total_amount: 4000,
  currency: 'USD',
  line_items: [
    {
      id: 'item-uuid',
      description: 'Monthly Cleaning Service',
      quantity: 1,
      unit_price: 2000,
      total_price: 2000,
      sequence_order: 0
    }
  ]
}
```

### Update Quote

Update a quote. If the quote was already sent, a new version is created automatically.

```javascript
// Update existing quote
const quote = await quotes.update('quote-id', {
  notes: 'Updated notes',
  valid_until: '2024-03-01',
  line_items: [
    // Updated line items
  ]
});

// Force new version creation
const newVersion = await quotes.update('quote-id', {
  line_items: [ ... ]
}, true);  // createNewVersion = true
```

### Send Quote

Send a quote (updates status to 'sent' and triggers email/message workflow).

```javascript
const quote = await quotes.send('quote-id');
```

### Mark Quote Viewed

Mark a quote as viewed.

```javascript
const quote = await quotes.markViewed('quote-id');
```

### Respond to Quote

Accept or reject a quote.

```javascript
// Accept quote
const quote = await quotes.respond('quote-id', 'accepted');

// Reject quote
const quote = await quotes.respond('quote-id', 'rejected');
```

### Get Deal Quotes

Get all quotes for a deal.

```javascript
const quotesList = await quotes.getDealQuotes('deal-id');
```

## Sequences API

### Get All Sequences

Get all follow-up sequences for the company.

```javascript
const sequences = await sequences.getAll();

// Returns array of sequences with steps
```

### Get Sequence Details

Get sequence with all steps.

```javascript
const sequence = await sequences.getDetails('sequence-id');
```

### Create Sequence

Create a new follow-up sequence with steps.

```javascript
const sequence = await sequences.create(
  {
    name: 'Prospecting Follow-up',
    trigger_stage: 'prospecting',
    enabled: true,
    stop_on_reply: true,
    stop_on_stage_change: true,
    max_attempts: 5
  },
  [
    {
      step_order: 1,
      action_type: 'email',
      delay_days: 0,
      delay_hours: 0,
      subject: 'Following up on our conversation',
      body: 'Hi John, I wanted to follow up...'
    },
    {
      step_order: 2,
      action_type: 'call',
      delay_days: 3,
      delay_hours: 0
    },
    {
      step_order: 3,
      action_type: 'message',
      delay_days: 7,
      delay_hours: 0,
      subject: 'Final follow-up',
      body: 'Last attempt to connect...'
    }
  ]
);
```

### Start Sequence

Start a sequence for a specific deal.

```javascript
const execution = await sequences.start('sequence-id', 'deal-id');
```

### Stop Sequence

Stop an active sequence execution.

```javascript
const execution = await sequences.stop('execution-id', 'User manually stopped');
```

## Events API

### Log Call

Log a call event and update deal touch count.

```javascript
const call = await events.logCall({
  deal_id: 'deal-uuid',
  contact_id: 'contact-uuid',
  call_type: 'outbound',
  duration_seconds: 600,
  outcome: 'interested',
  notes: 'Discussed pricing and timeline'
});
```

### Log Door Visit

Log a door visit and update deal touch count.

```javascript
const visit = await events.logVisit({
  deal_id: 'deal-uuid',
  contact_id: 'contact-uuid',
  visit_date: '2024-01-15T10:00:00Z',
  outcome: 'meeting_scheduled',
  notes: 'Met with facility manager, scheduled follow-up'
});
```

### Log Message

Log a message (email, SMS, etc.) and update deal touch count if outbound.

```javascript
const message = await events.logMessage({
  deal_id: 'deal-uuid',
  contact_id: 'contact-uuid',
  direction: 'outbound',
  channel: 'email',
  subject: 'Quote Follow-up',
  body: 'Thank you for your interest...'
});
```

### Get Deal Events

Get all events for a deal.

```javascript
const eventsList = await events.getDealEvents('deal-id', {
  limit: 100,
  offset: 0
});
```

## Analytics API

### Get Funnel Analytics

Get sales funnel metrics: calls → connections → quotes → wins.

```javascript
const analytics = await analytics.getFunnel({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  companyId: 'company-uuid'  // Optional, defaults to current user
});

// Returns:
{
  period: {
    start: '2024-01-01T00:00:00Z',
    end: '2024-01-31T23:59:59Z'
  },
  metrics: {
    calls: 150,
    connections: 120,
    quotes_sent: 80,
    wins: 25
  },
  conversion_rates: {
    calls_to_connections: 80.0,
    connections_to_quotes: 66.67,
    quotes_to_wins: 31.25,
    overall: 16.67
  }
}
```

### Get Funnel Breakdown

Get detailed stage breakdown with counts and values.

```javascript
const breakdown = await analytics.getBreakdown({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31')
});

// Returns:
{
  period: { ... },
  stage_breakdown: {
    counts: {
      prospecting: 50,
      qualification: 30,
      proposal: 20,
      negotiation: 10,
      closed_won: 25,
      closed_lost: 5
    },
    values: {
      prospecting: 500000,
      qualification: 400000,
      proposal: 300000,
      negotiation: 200000,
      closed_won: 500000,
      closed_lost: 50000
    }
  },
  total_deals: 140,
  total_value: 1950000
}
```

### Get Activity Analytics

Get activity counts by type (calls, messages, visits, events).

```javascript
const activity = await analytics.getActivity({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31')
});

// Returns:
{
  period: { ... },
  activity: {
    calls: 150,
    messages: 200,
    visits: 30,
    events: 500,
    total: 880
  }
}
```

## Data Models

### Deal

```typescript
{
  id: UUID
  company_id: UUID
  contact_id: UUID?
  site_id: BIGINT?
  title: string
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'
  deal_value: number?
  probability: number (0-100)
  expected_close_date: Date?
  priority_score: number (calculated)
  last_touch_at: Date?
  touch_count: number
  objection_tags: string[]?
  assigned_to: UUID?
  notes: string?
  metadata: object
  created_at: Date
  updated_at: Date
}
```

### Quote

```typescript
{
  id: UUID
  deal_id: UUID
  template_id: UUID?
  version: number
  variant: 'good' | 'better' | 'best'?
  status: 'drafted' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'
  total_amount: number
  currency: string
  valid_until: Date?
  notes: string?
  line_items: QuoteLineItem[]
  created_at: Date
  updated_at: Date
  sent_at: Date?
  viewed_at: Date?
  accepted_at: Date?
  rejected_at: Date?
}
```

### QuoteLineItem

```typescript
{
  id: UUID
  quote_id: UUID
  description: string
  quantity: number
  unit_price: number
  total_price: number (calculated)
  sequence_order: number
  metadata: object
}
```

### Sequence

```typescript
{
  id: UUID
  company_id: UUID
  name: string
  trigger_stage: string
  enabled: boolean
  stop_on_reply: boolean
  stop_on_stage_change: boolean
  max_attempts: number?
  steps: SequenceStep[]
  created_at: Date
  updated_at: Date
}
```

### SequenceStep

```typescript
{
  id: UUID
  sequence_id: UUID
  step_order: number
  action_type: 'email' | 'call' | 'message' | 'task'
  delay_days: number
  delay_hours: number
  subject: string?
  body: string?
  metadata: object
}
```

### DealEvent

```typescript
{
  id: UUID
  deal_id: UUID
  event_type: string
  user_id: UUID?
  old_value: object?
  new_value: object?
  metadata: object
  created_at: Date (immutable)
}
```

## Error Handling

All API functions throw errors that should be caught and handled:

```javascript
try {
  const deal = await deals.getDetails('deal-id');
} catch (error) {
  console.error('Error fetching deal:', error);
  // Handle error (show notification, etc.)
}
```

Common error scenarios:

- **Authentication errors**: User not authenticated
- **Not found errors**: Resource doesn't exist
- **Validation errors**: Invalid input data
- **Database errors**: Supabase query failures

## Priority Score Calculation

Deal priority scores are automatically calculated using the formula:

```
priority_score = (deal_value_weighted) * (close_likelihood_proxy) * (urgency_decay) * 100
```

Where:

- **deal_value_weighted**: Normalized deal value (0-1, using $100k as max)
- **close_likelihood_proxy**: Based on stage multiplier (60%), probability (20%), and touch bonus (20%)
- **urgency_decay**: Exponential decay based on recency of last touch (exp(-days_since_touch / 10))

Scores are recalculated automatically on deal updates via database triggers.

## Stop Rules for Sequences

Sequences automatically stop when:

1. **Stop on reply**: Contact replies (requires checking deal_messages for inbound messages)
2. **Stop on stage change**: Deal stage changes from trigger stage
3. **Max attempts**: Sequence reaches maximum attempt count (if set)

Stop rules are checked before each step execution.

## Database Schema

The complete database schema is defined in `ADD_SALES_PORTAL_SCHEMA.sql`. Key tables:

- `deals` - Deal records with automatic priority scoring
- `contacts` - Contact information
- `quotes` - Quote records with versioning
- `quote_line_items` - Quote line items
- `quote_templates` - Quote templates by vertical
- `follow_up_sequences` - Follow-up sequences
- `sequence_steps` - Sequence step definitions
- `sequence_executions` - Active sequence executions
- `deal_events` - Immutable event log
- `calls` - Call logs
- `deal_messages` - Sales messages
- `door_visits` - Door visit logs

## Testing

Unit tests are located in `js/services/__tests__/`:

- `deal-service.test.js` - Priority scoring tests
- `sequence-service.test.js` - Stop rules tests
- `api-integration.test.js` - API integration tests

Run tests with your preferred JavaScript test runner (Jest, Mocha, etc.).

## Usage Examples

### Complete Deal Workflow

```javascript
import { deals, quotes, events, sequences } from './js/api/sales-portal-api.js';

// 1. Get prioritized deal queue
const queue = await deals.getQueue({ limit: 10 });

// 2. Open a deal
const deal = await deals.getDetails(queue.data[0].id);

// 3. Log a call
await events.logCall({
  deal_id: deal.id,
  call_type: 'outbound',
  duration_seconds: 600,
  outcome: 'interested'
});

// 4. Create and send quote
const quote = await quotes.create({
  deal_id: deal.id,
  line_items: [
    { description: 'Service', quantity: 1, unit_price: 2000 }
  ]
});

await quotes.send(quote.id);

// 5. Start follow-up sequence
await sequences.start('sequence-id', deal.id);

// 6. Update stage when quote is accepted
await deals.updateStage(deal.id, 'negotiation');

// 7. Close deal when won
await deals.close(deal.id, 'won');
```

## Assumptions

1. **Company ID**: Uses authenticated user's ID as `company_id` for multi-tenancy
2. **Currency**: Default currency is USD (configurable per quote)
3. **Timezones**: All timestamps are in UTC
4. **Email/Messaging**: Quote sending triggers email/message workflow (integration point)
5. **Scheduled Jobs**: Sequence execution requires a background job/cron (not implemented in API)
6. **RLS**: Row Level Security is disabled for initial implementation (can be enabled per company_id later)
