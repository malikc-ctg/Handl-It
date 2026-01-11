# Core Sales CRM Data Model

## Overview

This document describes the core database schema for the Sales CRM system, including Leads, Contacts, Deals, Quotes, Calls, Messages, Tasks, Sequences, Routes, Territories, Doors, and an immutable Event Log.

## Database System

- **Database**: PostgreSQL (via Supabase)
- **Multi-tenancy**: `workspace_id` references `company_profiles(id)`
- **Row Level Security**: Enabled on all tables
- **Event System**: Immutable event log for audit trail

---

## Entity Relationship Diagram (ERD)

```
┌─────────────────┐
│  Workspace      │
│ (company_profiles)│
│  id (PK)        │
└────────┬────────┘
         │
         │ workspace_id
         │
    ┌────┴─────────────────────────────────────────────────────┐
    │                                                           │
┌───▼────────┐      ┌──────────────┐      ┌─────────────────┐
│   Leads    │      │   Contacts   │      │  Deal Stages    │
│            │      │              │      │                 │
│ id (PK)    │      │ id (PK)      │      │ id (PK)         │
│ workspace_id│─────┤ workspace_id │      │ workspace_id    │
│ source     │      │ lead_id      │      │ stage_name      │
│ status     │◄─────┤ phone        │      │ stage_enum      │
│ contact_id │      │ email        │      │ probability     │
│ tags[]     │      │ role         │      └────────┬────────┘
│ metadata   │      │ address      │               │
└────┬───────┘      │ metadata     │               │ deal_stage_id
     │              └──────────────┘               │
     │ lead_id                                      │
     │                                              │
┌────▼──────────┐                         ┌────────▼──────────┐
│    Deals      │                         │   Territories     │
│               │                         │                   │
│ id (PK)       │                         │ id (PK)           │
│ workspace_id  │                         │ workspace_id      │
│ lead_id       │                         │ name              │
│ stage         │                         │ boundary          │
│ value_estimate│                         │ geojson           │
│ health        │                         └────────┬──────────┘
│ assigned_user │                                   │
│ last_touch_at │                              territory_id
│ won_at        │                                   │
│ lost_at       │                                   │
│ lost_reason   │                                   │
└──────┬────────┘                         ┌────────▼──────────┐
       │                                  │      Doors        │
       │ deal_id                          │                   │
       │                                  │ id (PK)           │
┌──────▼──────────┐                      │ workspace_id      │
│    Quotes       │                      │ territory_id      │
│                 │                      │ address           │
│ id (PK)         │                      │ lat/lng           │
│ deal_id         │                      │ property_type     │
│ template_id     │                      │ cooldown_until    │
│ version         │                      └────────┬──────────┘
│ variant         │                               │ door_id
│ total_amount    │                               │
│ status          │                         ┌─────▼────────┐
└──────┬──────────┘                         │  Door Visits │
       │ quote_id                           │              │
       │                                    │ id (PK)      │
┌──────▼────────────┐                      │ route_id     │
│ Quote Line Items  │                      │ door_id      │
│                   │                      │ deal_id      │
│ id (PK)           │                      │ outcome      │
│ quote_id          │                      │ visit_time   │
│ description       │                      └──────────────┘
│ quantity          │
│ unit_price        │
│ total (computed)  │
│ cost_basis        │
│ margin (hidden)   │
└───────────────────┘

┌──────────────┐
│    Calls     │
│              │
│ id (PK)      │
│ workspace_id │
│ deal_id      │
│ quo_call_id  │ (UNIQUE - Quo integration)
│ direction    │
│ from_number  │
│ to_number    │
│ started_at   │
│ outcome      │
│ consent      │
│ recording_url│
│ transcript   │
└──────────────┘

┌──────────────┐
│   Messages   │
│              │
│ id (PK)      │
│ workspace_id │
│ deal_id      │
│ provider     │
│ channel      │
│ direction    │
│ status       │
│ body         │
└──────────────┘

┌──────────────┐
│    Tasks     │
│              │
│ id (PK)      │
│ workspace_id │
│ deal_id      │
│ assigned_user│
│ type         │
│ status       │
│ due_at       │
└──────────────┘

┌──────────────┐      ┌──────────────┐      ┌──────────────────┐
│  Sequences   │      │ Sequence Steps│      │Sequence Executions│
│              │      │              │      │                  │
│ id (PK)      │─────▶│ id (PK)      │      │ id (PK)          │
│ workspace_id │      │ sequence_id  │      │ sequence_id      │
│ stage_trigger│      │ step_order   │      │ deal_id          │
│ stop_rules   │      │ delay_days   │      │ current_step     │
│              │      │ channel      │      │ status           │
└──────────────┘      │ template_ref │      │ next_execution   │
                      └──────────────┘      └──────────────────┘

┌──────────────┐
│   Routes     │
│              │
│ id (PK)      │
│ workspace_id │
│ territory_id │
│ assigned_user│
│ route_date   │
│ status       │
│ started_at   │
│ completed_at │
└──────────────┘

┌──────────────┐
│    Events    │ (Immutable)
│              │
│ id (PK)      │
│ event_type   │
│ entity_type  │
│ entity_id    │
│ actor_type   │
│ actor_id     │
│ payload      │ (JSONB)
│ timestamp    │
└──────────────┘
```

---

## Core Entities

### 1. Leads

Represents potential customers who have shown interest.

**Key Fields:**
- `id`: UUID primary key
- `workspace_id`: References `company_profiles(id)` for multi-tenancy
- `source`: Where the lead came from ('website', 'referral', 'cold_outreach', etc.)
- `status`: Enum ('new', 'contacted', 'qualified', 'unqualified', 'converted', 'nurturing')
- `primary_contact_id`: References `contacts(id)`
- `tags`: Array of tags for categorization
- `metadata`: JSONB for flexible additional data

**Relationships:**
- Has one primary contact (optional)
- Can have multiple contacts
- Can convert to one or more deals

**Indexes:**
- `(workspace_id, updated_at DESC)` - High-performance list queries
- `status` - Filter by status
- `primary_contact_id` - Contact lookup

---

### 2. Contacts

Normalized contact information with deduplication via phone/email.

**Key Fields:**
- `id`: UUID primary key
- `workspace_id`: Workspace/tenant identifier
- `normalized_phone`: E.164 format phone number (indexed)
- `email`: Email address (indexed)
- `first_name`, `last_name`: Contact names
- `full_name`: Generated computed column
- `role`: Enum ('decision_maker', 'influencer', 'gatekeeper', 'user', 'champion', 'other')
- `address fields`: Street, city, state, postal, country

**Constraints:**
- Must have either `email` OR `normalized_phone`
- Phone numbers should be normalized to E.164 format

**Indexes:**
- `normalized_phone` - Critical for call matching
- `email` - Email lookups
- `lead_id` - Lead association

---

### 3. Deals

Sales opportunities linked to leads.

**Key Fields:**
- `id`: UUID primary key
- `workspace_id`: Workspace identifier
- `lead_id`: Source lead (optional)
- `title`: Deal name/description
- `stage`: Enum ('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost')
- `deal_stage_id`: References `deal_stages(id)` for custom stages
- `value_estimate`: Estimated deal value (NUMERIC)
- `health`: Enum ('at_risk', 'on_track', 'exceeding', 'needs_attention')
- `assigned_user_id`: Assigned sales rep
- `last_touch_at`: Auto-updated via triggers
- `won_at`, `lost_at`: Timestamps for closed deals
- `lost_reason`: Enum for lost deals

**Constraints:**
- Closed won deals require `won_at` and cannot have `lost_at` or `lost_reason`
- Closed lost deals require `lost_at` and `lost_reason`, cannot have `won_at`

**Indexes:**
- `(workspace_id, updated_at DESC)` - List queries
- `(stage, last_touch_at DESC)` - Pipeline queries
- `assigned_user_id` - User assignment queries

---

### 4. Deal Stages

Configurable sales pipeline stages (workspace-specific or default).

**Key Fields:**
- `id`: UUID primary key
- `workspace_id`: NULL for default stages, UUID for custom
- `stage_name`: Display name
- `stage_enum`: Enum value
- `display_order`: Sort order
- `probability`: 0-100 probability of closing

**Unique Constraint:**
- `(workspace_id, stage_enum)` - Only one active stage per enum per workspace

---

### 5. Quotes

Proposals sent to prospects with versioning support.

**Key Fields:**
- `id`: UUID primary key
- `deal_id`: Associated deal
- `quote_template_id`: Template reference (optional)
- `quote_version`: Integer version number
- `variant`: Optional ('good', 'better', 'best')
- `status`: Enum ('drafted', 'sent', 'viewed', 'accepted', 'rejected', 'expired')
- `total_amount`: Calculated from line items
- `valid_until`: Expiration date
- Timestamps: `sent_at`, `viewed_at`, `accepted_at`, `rejected_at`

**Unique Constraint:**
- `(deal_id, quote_version)` - Versioning per deal

**Relationships:**
- Has many line items
- Belongs to one deal
- Can reference a template

---

### 6. Quote Line Items

Individual items within a quote.

**Key Fields:**
- `id`: UUID primary key
- `quote_id`: Parent quote
- `description`: Item description
- `category`: Category ('labor', 'materials', 'equipment', etc.)
- `quantity`: Numeric quantity
- `unit`: Unit type ('hour', 'sqft', 'item', etc.)
- `unit_price`: Price per unit
- `total`: Computed (quantity * unit_price)
- `cost_basis`: Admin-only cost (for margin calculation)
- `margin_percentage`, `margin_amount`: Admin-only fields (hidden from customer)

**Computed Columns:**
- `total`: `quantity * unit_price`
- `margin_amount`: `(quantity * unit_price) - (quantity * cost_basis)`

---

### 7. Calls

Call tracking integrated with Quo phone system.

**Key Fields:**
- `id`: UUID primary key
- `workspace_id`: Workspace identifier
- `deal_id`, `lead_id`: Optional associations
- **`quo_call_id`: UNIQUE** - Quo provider event ID (critical for idempotency)
- `direction`: 'inbound' or 'outbound'
- `from_number`, `to_number`: E.164 normalized numbers
- `started_at`, `ended_at`, `answered_at`: Timing
- `duration_seconds`: Call duration
- `outcome`: Enum ('connected', 'no_answer', 'voicemail', 'busy', 'failed', 'cancelled', 'missed')
- **Privacy Fields:**
  - `call_recording_consent`: Boolean consent flag
  - `recording_url`: Only if consent = TRUE
  - `transcript_text`: Only if consent = TRUE
- `summary_text`: AI-generated summary
- `objection_tags`: Array of objection tags

**Constraints:**
- `quo_call_id` must be UNIQUE (prevents duplicate webhook processing)
- `recording_url` and `transcript_text` require `call_recording_consent = TRUE`

**Indexes:**
- `quo_call_id` UNIQUE - Critical for Quo integration
- `from_number`, `to_number` - Phone matching
- `started_at` - Timeline queries

---

### 8. Messages

SMS/Email/WhatsApp messages (outbound and inbound).

**Key Fields:**
- `id`: UUID primary key
- `workspace_id`: Workspace identifier
- `deal_id`, `lead_id`: Optional associations
- `provider`: Provider name ('twilio', 'sendgrid', 'resend', etc.)
- `provider_message_id`: Provider's message ID
- `channel`: Enum ('sms', 'email', 'whatsapp', 'push')
- `direction`: 'inbound' or 'outbound'
- `subject`: Email subject (optional)
- `body`: Message content
- `from_address`, `to_address`: Normalized addresses
- `status`: Enum ('pending', 'sent', 'delivered', 'read', 'failed', 'bounced')
- Timestamps: `sent_at`, `delivered_at`, `read_at`

**Indexes:**
- `provider_message_id` - Provider lookups
- `(channel, direction)` - Channel queries

---

### 9. Tasks

Next actions and follow-up tasks.

**Key Fields:**
- `id`: UUID primary key
- `workspace_id`: Workspace identifier
- `deal_id`, `lead_id`: Optional associations
- `title`: Task description
- `type`: Enum ('call', 'email', 'meeting', 'follow_up', 'quote_preparation', 'proposal_review', 'other')
- `status`: Enum ('pending', 'in_progress', 'completed', 'cancelled', 'deferred')
- `assigned_user_id`: Assigned user
- `due_at`: Due date/time
- `completed_at`: Completion timestamp
- `priority`: 0-5 priority level

**Indexes:**
- `assigned_user_id` - User task lists
- `due_at` WHERE status NOT IN ('completed', 'cancelled') - Upcoming tasks

---

### 10. Sequences

Follow-up automation sequences triggered by deal stages.

**Key Fields:**
- `id`: UUID primary key
- `workspace_id`: Workspace identifier
- `name`: Sequence name
- `stage_trigger`: Deal stage that triggers this sequence
- **Stop Rules:**
  - `stop_on_reply`: Boolean
  - `stop_on_stage_change`: Boolean
  - `stop_on_deal_closed`: Boolean
  - `max_attempts`: Integer
- `enabled`: Boolean active flag

**Relationships:**
- Has many steps (ordered)
- Has many executions (one per deal)

---

### 11. Sequence Steps

Individual steps within a sequence.

**Key Fields:**
- `id`: UUID primary key
- `sequence_id`: Parent sequence
- `step_order`: Order within sequence (unique per sequence)
- `delay_days`, `delay_hours`: Delay before executing
- `channel`: Enum ('email', 'sms', 'call', 'task')
- `email_template_id`, `sms_template_id`: Template references (optional)
- `subject`, `body`: Content (fallback if no template)

**Unique Constraint:**
- `(sequence_id, step_order)` - Ordering within sequence

---

### 12. Sequence Executions

Active sequence executions for deals.

**Key Fields:**
- `id`: UUID primary key
- `sequence_id`: Sequence being executed
- `deal_id`: Target deal
- `current_step`: Current step index
- `status`: Enum ('active', 'paused', 'stopped', 'completed')
- `stopped_reason`: Why it stopped (if applicable)
- `attempt_count`: Number of steps executed
- `last_executed_at`: Last execution time
- `next_execution_at`: When to execute next step

**Indexes:**
- `(status, next_execution_at)` WHERE status = 'active' - Scheduled executions

---

### 13. Territories

Geographic sales territories.

**Key Fields:**
- `id`: UUID primary key
- `workspace_id`: Workspace identifier
- `name`: Territory name
- **Geographic Boundaries:**
  - `boundary`: PostGIS GEOGRAPHY(POLYGON) if PostGIS extension available
  - `min_latitude`, `max_latitude`, `min_longitude`, `max_longitude`: Bounding box
  - `encoded_polyline`: Google Polyline encoding
  - `geojson`: GeoJSON polygon representation

**Note:** Supports multiple geographic storage methods for compatibility:
1. PostGIS (preferred if available)
2. Bounding box + encoded polyline + GeoJSON (fallback)

---

### 14. Routes

Sales routes assigned to users on specific dates.

**Key Fields:**
- `id`: UUID primary key
- `workspace_id`: Workspace identifier
- `territory_id`: Optional territory association
- `route_date`: Date of route
- `assigned_user_id`: Assigned sales rep
- `status`: Enum ('planned', 'in_progress', 'completed', 'cancelled')
- `started_at`, `completed_at`: Timestamps
- `location_tracking_enabled`: Boolean privacy flag

**Indexes:**
- `(id, status)` - Critical route status queries
- `route_date` - Date-based queries
- `assigned_user_id` - User route lists

---

### 15. Doors

Door targets (properties to visit).

**Key Fields:**
- `id`: UUID primary key
- `workspace_id`: Workspace identifier
- `territory_id`: Optional territory
- `address`: Street address
- `latitude`, `longitude`: GPS coordinates
- `property_type`: Enum ('residential', 'commercial', 'industrial', 'retail', 'office', 'mixed_use', 'other')
- `property_name`: Building/complex name
- `tags`: Array of tags
- `cooldown_until`: Prevent too-frequent visits
- `last_visit_at`: Last visit timestamp (auto-updated)

**Indexes:**
- `(latitude, longitude)` - Location queries
- `cooldown_until` - Cooldown queries

---

### 16. Door Visits

Actual visits to doors.

**Key Fields:**
- `id`: UUID primary key
- `route_id`: Parent route
- `door_id`: Target door
- `deal_id`: Optional deal association
- `visit_timestamp`: When visit occurred
- `outcome`: Enum ('met', 'not_home', 'refused', 'left_info', 'follow_up_scheduled', 'not_interested')
- `notes`: Visit notes
- `follow_up_task_id`: Optional follow-up task
- `visit_latitude`, `visit_longitude`: Verification location

**Triggers:**
- Auto-updates `doors.last_visit_at` and `doors.cooldown_until` on insert

---

### 17. Events (Immutable Event Log)

Immutable audit log for all system events.

**Key Fields:**
- `id`: UUID primary key
- `event_type`: Flexible text field (e.g., 'deal.created', 'deal.stage_changed')
- `entity_type`: Entity type ('lead', 'deal', 'contact', 'call', etc.)
- `entity_id`: Entity UUID
- `actor_type`: Enum ('user', 'system', 'customer', 'automation')
- `actor_id`: Actor UUID (references `auth.users(id)` if actor_type = 'user')
- `payload`: JSONB flexible event data
- `timestamp`: Immutable timestamp (set on insert, never updated)

**Constraints:**
- Immutable (no updates/deletes via RLS policies)
- No `updated_at` field (deliberately immutable)

**Indexes:**
- `(entity_type, entity_id, timestamp DESC)` - Entity event history
- `timestamp DESC` - Global event timeline
- `(actor_type, actor_id)` - Actor activity

**Helper Function:**
```sql
emit_event(
  event_type TEXT,
  entity_type TEXT,
  entity_id UUID,
  actor_type TEXT,
  actor_id UUID DEFAULT NULL,
  payload JSONB DEFAULT '{}'
) RETURNS UUID
```

---

## Privacy and Consent

### Call Recording Consent
- `calls.call_recording_consent`: Boolean flag per call
- `recording_url` and `transcript_text` only stored if `call_recording_consent = TRUE`
- Can be set at workspace level (future: workspace settings table)

### Location Tracking
- `routes.location_tracking_enabled`: Per-route session flag
- User-level location tracking consent (future: user preferences table)

### Retention Policies
- Webhook logs: 90-day retention (via cleanup function)
- Transcripts/recordings: Policy-driven retention (future: retention fields)

---

## Critical Indexes

### High-Value Indexes

1. **Workspace + Updated**: `(workspace_id, updated_at DESC)`
   - Used by: `leads`, `deals`
   - Purpose: Fast list queries with pagination

2. **Normalized Phone**: `normalized_phone`
   - Used by: `contacts`
   - Purpose: Call matching and deduplication

3. **Deal Stage + Last Touch**: `(stage, last_touch_at DESC)`
   - Used by: `deals`
   - Purpose: Pipeline queries

4. **Quo Call ID (UNIQUE)**: `quo_call_id`
   - Used by: `calls`
   - Purpose: Webhook idempotency (critical for Quo integration)

5. **Route Status**: `(id, status)`
   - Used by: `routes`
   - Purpose: Route status queries

6. **Event Entity Timeline**: `(entity_type, entity_id, timestamp DESC)`
   - Used by: `events`
   - Purpose: Entity event history

---

## Helper Functions

### Event Emission
```sql
SELECT emit_event(
  'deal.created',
  'deal',
  deal_id,
  'user',
  user_id,
  '{"additional": "data"}'::jsonb
);
```

### Workspace Deal Stages
```sql
SELECT seed_workspace_deal_stages(workspace_id);
```

### Enum Helpers
```sql
SELECT get_lead_statuses();        -- Returns TEXT[]
SELECT get_deal_stages();          -- Returns TEXT[]
SELECT get_call_outcomes();        -- Returns TEXT[]
SELECT get_property_types();       -- Returns TEXT[]
-- ... etc
```

---

## Migration Order

1. **CORE_SALES_CRM_SCHEMA.sql** - Core tables, enums, indexes
2. **CORE_SALES_CRM_RLS_AND_CONSTRAINTS.sql** - RLS policies, workspace foreign keys
3. **CORE_SALES_CRM_SEED_DATA.sql** - Default stages, helper functions, views
4. **CORE_SALES_CRM_TESTS.sql** - Unit tests (optional)

---

## Views

### `active_deals_summary`
Summary view of active deals with lead and contact information.

### `quote_summary`
Quotes with aggregated line item counts and totals.

### `recent_activity`
Combined view of calls, messages, tasks, and door visits from last 30 days.

---

## Notes

- All timestamps use `TIMESTAMPTZ` (timezone-aware)
- Multi-tenancy via `workspace_id` references `company_profiles(id)`
- Row Level Security enabled on all tables
- Events table is immutable (no updates/deletes)
- Phone numbers should be normalized to E.164 format
- Quo integration requires unique `quo_call_id` for idempotency
- Geographic data supports PostGIS or fallback methods

---

## Future Enhancements

- Workspace-level consent settings
- User-level location tracking preferences
- Retention policy fields for transcripts/recordings
- PostGIS extension detection and usage
- Additional event types as needed
- Quote template versioning
- Advanced sequence branching logic
