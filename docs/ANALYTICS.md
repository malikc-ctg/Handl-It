# Analytics System Documentation

## Overview

The NFG Analytics system provides comprehensive sales and performance metrics through a RESTful API and manager dashboard. All metrics are built on an event stream architecture for accuracy and performance.

## Architecture

### Event Stream (Primary Source of Truth)

All analytics are derived from the `events` table, which automatically captures actions from:
- Calls
- Connections (meetings/demos)
- Quotes (proposals)
- Wins (closed deals)
- Door knocks
- Appointments

Events are automatically created via database triggers when actions are recorded in their respective tables.

### Database Functions (RPC)

All analytics queries are implemented as PostgreSQL functions (RPC) that:
- Enforce Row-Level Security (RBAC)
- Use efficient aggregations with proper indexes
- Support filtering by date range, rep, territory, vertical, and source
- Return JSON for easy consumption

### API Endpoints (Edge Functions)

Supabase Edge Functions provide REST endpoints that:
- Handle authentication
- Call database functions
- Return formatted JSON responses
- Support CORS for frontend consumption

## Metrics Definitions

### 1. Sales Funnel: Calls → Connections → Quotes → Wins

**Definition**: Tracks progression through the sales pipeline.

**Metrics**:
- **Calls**: Total number of calls made
- **Connections**: Meaningful interactions (meetings, demos, site visits)
- **Quotes**: Proposals sent to prospects
- **Wins**: Closed deals

**Conversion Rates**:
- Calls to Connections: `(connections / calls) * 100`
- Connections to Quotes: `(quotes / connections) * 100`
- Quotes to Wins: `(wins / quotes) * 100`

**Endpoint**: `GET /functions/v1/analytics/funnel`

**Query Parameters**:
- `start_date` (optional): YYYY-MM-DD format
- `end_date` (optional): YYYY-MM-DD format
- `user_id` (optional): Filter by rep
- `territory` (optional): Filter by territory
- `vertical` (optional): Filter by industry vertical
- `source` (optional): Filter by lead source

**Response**:
```json
{
  "data": {
    "calls": 100,
    "connections": 50,
    "quotes": 25,
    "wins": 10,
    "conversion_rates": {
      "calls_to_connections": 50.0,
      "connections_to_quotes": 50.0,
      "quotes_to_wins": 40.0
    }
  }
}
```

### 2. Average Time to Close by Vertical

**Definition**: Average number of days from first call to closed deal, grouped by industry vertical.

**Calculation**: 
- For each win: `closed_date - first_call_date` (or `created_at` if `first_call_date` is null)
- Average across all wins in the vertical

**Endpoint**: `GET /functions/v1/analytics/time-to-close`

**Response**:
```json
{
  "data": [
    {
      "vertical": "Commercial",
      "average_days": 45.5,
      "median_days": 42.0,
      "deal_count": 10,
      "total_value": 150000.00
    }
  ]
}
```

### 3. Calls Per Closed Deal

**Definition**: Average number of calls required to close a deal.

**Calculation**: `total_calls / total_closed_deals`

**Endpoint**: `GET /functions/v1/analytics/calls-per-deal`

**Response**:
```json
{
  "data": {
    "average_calls_per_deal": 12.5,
    "total_calls": 250,
    "total_deals": 20,
    "by_user": [
      {
        "user_id": "uuid",
        "user_name": "John Doe",
        "calls_count": 50,
        "deals_count": 5,
        "calls_per_deal": 10.0
      }
    ]
  }
}
```

### 4. Stalled Deals

**Definition**: Deals with no activity (call, connection, or quote) for X days.

**Default**: 14 days without touch

**Endpoint**: `GET /functions/v1/analytics/stalled-deals`

**Query Parameters**:
- `days_without_touch` (optional, default: 14)
- `user_id`, `territory`, `vertical` (optional filters)

**Response**:
```json
{
  "data": [
    {
      "site_id": 123,
      "site_name": "ABC Corporation",
      "last_activity_date": "2024-01-15T00:00:00Z",
      "days_since_touch": 18,
      "last_quote_value": 50000.00,
      "assigned_user_id": "uuid",
      "assigned_user_name": "John Doe",
      "territory": "North",
      "vertical": "Commercial"
    }
  ]
}
```

### 5. Doors Knocked Per Hour

**Definition**: Average number of doors knocked per hour of field work.

**Calculation**: `total_door_knocks / total_hours_worked`

**Endpoint**: `GET /functions/v1/analytics/doors-per-hour`

**Response**:
```json
{
  "data": {
    "overall_average": 5.2,
    "by_user": [
      {
        "user_id": "uuid",
        "user_name": "John Doe",
        "total_knocks": 40,
        "total_hours": 8,
        "knocks_per_hour": 5.0
      }
    ],
    "by_territory": [
      {
        "territory": "North",
        "total_knocks": 100,
        "total_hours": 20,
        "knocks_per_hour": 5.0
      }
    ]
  }
}
```

### 6. Appointments Per Hour

**Definition**: Average number of appointments scheduled per hour of work.

**Calculation**: `total_appointments / total_hours_worked`

**Endpoint**: `GET /functions/v1/analytics/appointments-per-hour`

**Response**: Similar structure to doors-per-hour

### 7. Conversion by Territory

**Definition**: Conversion rates and activity counts grouped by territory.

**Metrics**:
- Door knocks, appointments, calls, connections, quotes, wins
- Knock to Appointment Rate: `(appointments / door_knocks) * 100`
- Quote to Win Rate: `(wins / quotes) * 100`
- Total deal value

**Endpoint**: `GET /functions/v1/analytics/conversion-by-territory`

**Response**:
```json
{
  "data": [
    {
      "territory": "North",
      "door_knocks": 200,
      "appointments": 50,
      "calls": 150,
      "connections": 75,
      "quotes": 40,
      "wins": 10,
      "knock_to_appointment_rate": 25.0,
      "quote_to_win_rate": 25.0,
      "total_deal_value": 500000.00
    }
  ]
}
```

### 8. Best Time of Day

**Definition**: Hourly breakdown of activity with conversion/completion rates.

**Activity Types**: `door_knock`, `appointment`, `call`

**Metrics**:
- Activity count per hour
- Conversion rate (for door knocks)
- Completion rate (for appointments)
- Answer rate (for calls)

**Endpoint**: `GET /functions/v1/analytics/best-time-of-day`

**Query Parameters**:
- `activity_type`: `door_knock`, `appointment`, or `call`

**Response**:
```json
{
  "data": [
    {
      "hour": 9,
      "hour_label": "09:00",
      "activity_count": 25,
      "conversion_rate": 20.0
    }
  ]
}
```

## Role-Based Access Control (RBAC)

### Admin
- **Access**: All data across all users, territories, and time periods
- **Filtering**: Can filter by any user, but defaults to all

### Manager (Client Role)
- **Access**: Own data + all team members (staff role users)
- **Filtering**: Can filter by team members or self

### Rep/Staff
- **Access**: Own data only
- **Filtering**: Can only view own metrics (user_id filter ignored or set to self)

### Implementation

RBAC is enforced at the database function level using:
- `get_accessible_user_ids()` helper function
- Role check via `user_profiles.role`
- Automatic filtering of queries based on role

## Database Schema

### Core Tables

#### `events`
Primary event stream table capturing all activities.

**Columns**:
- `id` (UUID, PK)
- `event_type` (TEXT): 'call', 'connection', 'quote', 'win', 'door_knock', 'appointment'
- `entity_type` (TEXT): Type of related entity
- `entity_id` (BIGINT): ID of related entity
- `user_id` (UUID): Rep who performed action
- `site_id` (BIGINT): Related site
- `territory` (TEXT): Territory identifier
- `vertical` (TEXT): Industry vertical
- `source` (TEXT): Lead source
- `metadata` (JSONB): Additional event data
- `created_at` (TIMESTAMPTZ): Event timestamp

**Indexes**:
- `idx_events_event_type`
- `idx_events_created_at`
- `idx_events_user_id`
- `idx_events_site_id`
- `idx_events_territory`
- `idx_events_vertical`
- `idx_events_entity` (entity_type, entity_id)
- `idx_events_type_date` (event_type, created_at)

#### `calls`, `connections`, `quotes`, `wins`
Denormalized tables for quick access and detailed queries.

#### `routes`, `door_knocks`, `appointments`
Route and field activity tracking.

#### `analytics_daily_rollup`
Pre-aggregated metrics for performance (optional, for very large datasets).

## Performance Optimization

### Indexes
All commonly filtered columns have indexes:
- Date columns for time-range queries
- User ID for RBAC filtering
- Territory, vertical, source for dimension filtering

### Query Patterns
- Use event stream (single source of truth)
- Aggregate at database level (not in application)
- Use date-based partitioning for large datasets (future enhancement)
- Consider daily rollups for historical data (optional)

### Avoiding N+1 Queries
- All user lookups use JOINs in a single query
- Territory/vertical aggregations done in GROUP BY
- No loops in application code

## Usage Examples

### JavaScript/TypeScript

```javascript
import { 
  getFunnelMetrics,
  getTimeToCloseByVertical,
  formatNumber,
  formatPercent
} from './js/analytics.js'

// Get funnel metrics
const funnel = await getFunnelMetrics({
  start_date: '2024-01-01',
  end_date: '2024-01-31',
  territory: 'North'
})

console.log(`Calls: ${formatNumber(funnel.calls)}`)
console.log(`Conversion: ${formatPercent(funnel.conversion_rates.quotes_to_wins)}`)
```

### Direct API Call

```bash
curl -X GET \
  'https://your-project.supabase.co/functions/v1/analytics/funnel?start_date=2024-01-01&end_date=2024-01-31' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

## Testing

Unit tests are located in `/test/analytics.test.js` and cover:
- Aggregation correctness
- Conversion rate calculations
- Time calculations
- RBAC filtering logic
- Edge cases (zero division, missing data)

Run tests with:
```bash
deno test test/analytics.test.js
```

## Setup Instructions

1. **Run Database Schema**:
   ```sql
   -- Run in Supabase SQL Editor
   \i ADD_ANALYTICS_SCHEMA.sql
   \i ADD_ANALYTICS_FUNCTIONS.sql
   ```

2. **Deploy Edge Function**:
   ```bash
   supabase functions deploy analytics
   ```

3. **Verify Setup**:
   - Check tables created in Supabase Dashboard
   - Verify indexes exist
   - Test RPC functions directly in SQL Editor
   - Test Edge Function endpoint

## Dashboard UI

The Sales Analytics dashboard is available in the Reports page:
- Navigate to **Reports** → **Sales Analytics** tab
- Use filters to drill down by rep, territory, vertical, source
- Charts update automatically based on filters
- All metrics respect RBAC automatically

## Future Enhancements

- Scheduled rollups for faster historical queries
- Export to CSV/PDF
- Custom date range picker in UI
- Real-time updates via Supabase Realtime
- Email reports (scheduled)
- Goal tracking and comparisons
- Predictive analytics (ML models)

## Troubleshooting

### Metrics showing zero
- Verify events are being created (check `events` table)
- Check date range filters
- Verify RBAC permissions (admin vs rep)
- Check that triggers are firing (test insert into `calls` table)

### Slow queries
- Verify indexes exist: `\d events` in psql
- Check query plans: `EXPLAIN ANALYZE`
- Consider adding `analytics_daily_rollup` table for historical data

### RBAC not working
- Verify `user_profiles.role` is set correctly
- Check `get_accessible_user_ids()` function
- Test RLS policies: `SELECT * FROM events` as different users

## Support

For issues or questions:
1. Check this documentation
2. Review test cases for examples
3. Check Supabase logs for Edge Function errors
4. Review database function logs
