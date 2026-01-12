# Deal Auto-Creation & Linking Implementation

## Overview

This implementation automatically creates and links deals from quotes whenever a quote revision is sent. The system is **server-side**, **idempotent**, and **deduplicated** to prevent duplicate deals.

## Features

✅ **Automatic Deal Creation**: Creates deals when quotes are sent  
✅ **Intelligent Deduplication**: Links quotes to existing deals based on account/contact  
✅ **Idempotent Operations**: Retries won't create duplicates  
✅ **Stage Mapping**: Automatically sets deal stage based on quote type  
✅ **Value Synchronization**: Keeps deal value in sync with quote totals  
✅ **Lifecycle Events**: Handles quote accepted, declined, expired, and viewed events  
✅ **Audit Trail**: All actions are logged in `deal_events` table  

## Database Schema

### New Tables

1. **deal_events** - Audit trail for all deal-related events
2. **idempotency_keys** - Prevents duplicate processing

### Extended Tables

**deals** table now includes:
- `deal_value` - Numeric deal value
- `value_type` - 'binding', 'non_binding_range', or 'unknown'
- `range_low`, `range_high` - For non-binding ranges
- `latest_quote_id` - Most recent quote linked
- `latest_quote_revision_number` - Most recent revision
- `source` - 'quote_auto' or 'manual'
- `is_closed` - Boolean flag
- `closed_reason` - 'won', 'lost', 'abandoned', 'other'
- `last_activity_at` - Last activity timestamp
- `next_action_at` - Next follow-up time
- `at_risk` - Flag for at-risk deals

## Setup Instructions

### 1. Run Database Migration

Execute the SQL schema file:

```sql
-- Run in Supabase SQL Editor
\i DEAL_AUTO_LINK_SCHEMA.sql
```

Or copy and paste the contents of `DEAL_AUTO_LINK_SCHEMA.sql` into your Supabase SQL Editor.

### 2. Verify Schema

Check that the following exist:
- `deals` table with new columns
- `deal_events` table
- `idempotency_keys` table
- Database functions: `on_quote_revision_sent`, `on_quote_accepted`, etc.

### 3. Test the Implementation

Run the test suite:

```bash
# If using a test runner
npm test test/deal-linking.test.js
```

## How It Works

### Quote Revision Sent

When a quote revision is sent (`sendRevision` function):

1. **Idempotency Check**: Checks if this event was already processed
2. **Find Matching Deal**: Looks for existing active deal with same account/contact
3. **Create or Link**: Creates new deal if none exists, otherwise links to existing
4. **Update Deal**: Sets stage, value, and activity timestamps
5. **Link Quote**: Updates `quotes.deal_id` to point to the deal
6. **Log Event**: Creates entry in `deal_events` table

### Deduplication Logic

Priority order for finding matching deals:

1. **Exact Match**: Same `account_id` + `primary_contact_id` + active (not closed)
2. **Account Match**: Same `account_id` + active + created within last 30 days
3. **No Match**: Create new deal

### Stage Mapping

- **Walkthrough Proposal** → `prospecting` stage
- **Final Quote** → `proposal` stage
- **Default** → `qualification` stage

### Value Precedence

- **Binding totals** always override non-binding ranges
- **Non-binding ranges** do NOT overwrite binding values
- Values are calculated from `quote_revisions.total` or `quote_line_items` ranges

### Quote Lifecycle Events

#### Quote Accepted
- Deal stage → `closed_won`
- `is_closed` → `true`
- `closed_reason` → `won`
- Deal value updated to binding total if present

#### Quote Declined
- Deal stage → `closed_lost`
- `is_closed` → `true`
- `closed_reason` → `lost`
- Decline reason stored in event metadata

#### Quote Expired
- Deal `at_risk` → `true`
- `next_action_at` → `NOW()` (immediate follow-up)
- Deal remains open (not automatically closed)

#### Quote Viewed
- `last_activity_at` → `NOW()`
- Event logged for tracking

## Configuration

Edit `js/services/deal-linking-service.js`:

```javascript
export const DEAL_LINKING_CONFIG = {
  followUpDefaultHours: 24,      // Default follow-up time
  dedupeWindowDays: 30,           // Deduplication window
  minBindingOverwrite: true,     // Binding overwrites non-binding
};
```

## API Functions

### Server-Side Functions (Database)

- `on_quote_revision_sent(quote_id, revision_number, follow_up_hours)`
- `on_quote_accepted(quote_id, revision_number, signer_name, signer_email)`
- `on_quote_declined(quote_id, revision_number, reason)`
- `on_quote_expired(quote_id, revision_number)`
- `on_quote_viewed(quote_id, revision_number)`
- `find_matching_active_deal(account_id, primary_contact_id, owner_user_id, dedupe_window_days)`

### Client-Side Service

Import from `js/services/deal-linking-service.js`:

```javascript
import { 
  onQuoteRevisionSent,
  onQuoteAccepted,
  onQuoteDeclined,
  onQuoteExpired,
  onQuoteViewed,
  findMatchingActiveDeal
} from './services/deal-linking-service.js';
```

## Integration Points

### Already Integrated

✅ **Quote Sending** (`js/quotes.js` - `sendRevision` function)  
✅ **Quote Acceptance** (`js/quotes.js` - `acceptFinalQuote` function)  
✅ **Quote Decline** (`js/quotes.js` - `declineFinalQuote` function)  
✅ **Quote Viewed** (`js/quotes.js` - `logPortalEvent` function)  

### Future Integration

- **Quote Expiration**: Add cron job or trigger to call `onQuoteExpired` when `expires_at` passes
- **Deal UI**: Update deals list to show `latest_quote_id` and quote status

## Testing

### Manual Testing

1. **Create a quote** with account and contact
2. **Send the quote** (revision)
3. **Check deals table** - should see new deal or link to existing
4. **Check deal_events** - should see `quote_revision_sent` event
5. **Accept/decline quote** - verify deal stage updates

### Automated Testing

Run the test suite in `test/deal-linking.test.js`:

```javascript
// Tests cover:
- Deduplication (same account/contact links to same deal)
- Idempotency (repeated calls don't create duplicates)
- Stage mapping (walkthrough vs final quote)
- Value precedence (binding over non-binding)
- Closed deals (won/lost deals don't reopen)
```

## Troubleshooting

### Deal Not Created

1. Check browser console for errors
2. Verify database functions exist: `SELECT routine_name FROM information_schema.routines WHERE routine_name LIKE 'on_quote%';`
3. Check RLS policies allow function execution
4. Verify quote has `account_id` set

### Duplicate Deals Created

1. Check `idempotency_keys` table - keys should prevent duplicates
2. Verify `check_idempotency` function is working
3. Check for race conditions (multiple simultaneous sends)

### Deal Stage Not Updating

1. Verify quote `revision_type` is correct
2. Check `map_revision_to_stage` function logic
3. Ensure deal is not already closed (won/lost deals don't change stage)

## Performance Considerations

- **Idempotency keys** are cleaned up after 7 days (or expiration)
- **Indexes** on `deals` table for fast lookups:
  - `idx_deals_account_id_active`
  - `idx_deals_account_contact_active`
  - `idx_deals_owner_stage`
- **Deduplication window** is configurable (default: 30 days)

## Security

- All database functions use `SECURITY DEFINER` for proper permissions
- RLS policies on `deal_events` and `idempotency_keys` tables
- Idempotency prevents replay attacks
- All operations are audited in `deal_events`

## Next Steps

1. ✅ Schema created
2. ✅ Functions implemented
3. ✅ Service layer created
4. ✅ Integration wired
5. ✅ Tests written
6. ⏳ Add quote expiration cron job
7. ⏳ Update deals UI to show quote status
8. ⏳ Add deal analytics based on quote lifecycle

## Support

For issues or questions:
1. Check browser console for errors
2. Review `deal_events` table for event history
3. Check database function logs in Supabase
4. Review test cases for expected behavior
