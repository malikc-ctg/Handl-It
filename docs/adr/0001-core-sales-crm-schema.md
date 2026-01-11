# ADR-0001: Core Sales CRM Database Schema Design

## Status
Accepted

## Context
We need to implement a comprehensive database schema for a Sales CRM system that supports:
- Leads, Contacts, Deals, and Sales Pipeline Management
- Quotes with versioning and line items
- Call tracking integration with Quo phone system
- SMS/Email messaging (outbound and inbound)
- Tasks and follow-up automation (Sequences)
- Door-to-door route management (Routes, Territories, Doors, Door Visits)
- Immutable event log for audit trail

The system must be multi-tenant, support PostgreSQL (via Supabase), and include proper indexing, constraints, and privacy controls.

## Decision
We will implement a comprehensive PostgreSQL schema with:

1. **Core Entities**:
   - `leads` - Potential customers with source tracking
   - `contacts` - Normalized contact information with phone/email deduplication
   - `deals` - Sales opportunities with stage tracking
   - `deal_stages` - Configurable pipeline stages (workspace-specific or default)
   - `quotes` - Proposals with versioning support
   - `quote_line_items` - Individual items with admin-only margin fields
   - `calls` - Call tracking with Quo integration (unique `quo_call_id` for idempotency)
   - `messages` - SMS/Email messages with provider tracking
   - `tasks` - Next actions and follow-ups
   - `sequences` - Follow-up automation triggered by stages
   - `routes`, `territories`, `doors`, `door_visits` - Route management
   - `events` - Immutable event log

2. **Multi-tenancy**: 
   - Use `workspace_id` that references `company_profiles(id)` when available
   - Fallback to NULL for workspace-agnostic data (default stages, etc.)
   - All tables have `workspace_id` for tenant isolation

3. **Enums**: 
   - Use PostgreSQL ENUM types for standardized values (stages, outcomes, reasons, etc.)
   - Provide helper functions to retrieve enum values as arrays

4. **Indexes**:
   - High-performance indexes on `(workspace_id, updated_at DESC)` for list queries
   - Unique index on `calls.quo_call_id` for Quo webhook idempotency
   - Indexes on `normalized_phone` for contact matching
   - Composite indexes on `(stage, last_touch_at)` for pipeline queries
   - Event log indexes on `(entity_type, entity_id, timestamp DESC)` for entity history

5. **Privacy & Consent**:
   - `call_recording_consent` boolean flag on calls
   - `recording_url` and `transcript_text` only stored if consent = TRUE (enforced via CHECK constraint)
   - `location_tracking_enabled` boolean on routes (per-session)

6. **Event System**:
   - Immutable `events` table with no updates/deletes (enforced via RLS)
   - `emit_event()` helper function for services
   - Auto-emit events via triggers for deal changes

7. **Geographic Data**:
   - Support PostGIS GEOGRAPHY(POLYGON) if extension available
   - Fallback to bounding box + encoded polyline + GeoJSON for compatibility

## Consequences

### Positive
- ✅ Comprehensive schema covering all requirements
- ✅ Proper multi-tenancy isolation via workspace_id
- ✅ High-performance indexes for common queries
- ✅ Privacy controls for call recordings and location tracking
- ✅ Immutable event log for audit trail
- ✅ Flexible geographic storage (PostGIS or fallback)
- ✅ Idempotent Quo integration via unique quo_call_id
- ✅ Versioned quotes with good/better/best variants
- ✅ Admin-only margin fields on quote line items

### Negative
- ⚠️ Requires PostGIS extension for full geographic support (fallback provided)
- ⚠️ Workspace foreign keys only added if company_profiles table exists
- ⚠️ Events table is immutable (cannot update/delete) - must be deliberate
- ⚠️ Complex RLS policies require careful testing

### Neutral
- Multi-migration approach (schema, RLS, seeds, tests) for modularity
- Service helper functions in JavaScript for application layer
- Views for common query patterns (active_deals_summary, quote_summary, recent_activity)

## Alternatives Considered

1. **Single migration file**: Rejected in favor of modular migrations (schema, RLS, seeds, tests) for better maintainability.

2. **Application-level enum validation**: Rejected in favor of PostgreSQL ENUM types for database-level integrity.

3. **Separate calls table vs. extending existing**: Decided to create dedicated `calls` table with Quo-specific fields (quo_call_id) for clear separation and idempotency.

4. **Mutable event log**: Rejected in favor of immutable events for audit trail integrity.

5. **PostGIS-only geographic storage**: Rejected in favor of hybrid approach (PostGIS if available, fallback otherwise) for compatibility.

## Implementation Notes

- Migration order: CORE_SALES_CRM_SCHEMA.sql → CORE_SALES_CRM_RLS_AND_CONSTRAINTS.sql → CORE_SALES_CRM_SEED_DATA.sql → CORE_SALES_CRM_TESTS.sql
- Service helpers: `js/services/crm-core-service.js` provides minimal JavaScript functions
- Documentation: `docs/DATA_MODEL.md` contains ERD-style description

## References
- PostgreSQL ENUM types: https://www.postgresql.org/docs/current/datatype-enum.html
- Supabase Row Level Security: https://supabase.com/docs/guides/auth/row-level-security
- PostGIS extension: https://postgis.net/
