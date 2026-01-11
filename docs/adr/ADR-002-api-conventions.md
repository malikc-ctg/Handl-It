# ADR-002: API Conventions

## Status
Accepted

## Context
The application uses Supabase PostgREST for the REST API layer. We need to establish conventions for API usage, error handling, pagination, ID formats, timestamps, and soft deletes to ensure consistency across all modules.

## Decision
We establish the following API conventions:

### API Base URL
- **Format**: `https://{project}.supabase.co/rest/v1/{table}`
- **Example**: `https://zqcbldgheimqrnqmbbed.supabase.co/rest/v1/deals`

### Authentication
- **Method**: Bearer token in `Authorization` header
- **Format**: `Authorization: Bearer {jwt_token}`
- **Token Source**: Supabase Auth session token

### Request Methods
- **GET**: Retrieve resources (with filtering, sorting, pagination)
- **POST**: Create new resources
- **PATCH**: Update existing resources (partial updates)
- **DELETE**: Delete resources (soft delete via `deleted_at`)

### Pagination
- **Method**: `Range` header
- **Format**: `Range: {start}-{end}`
- **Example**: `Range: 0-9` (first 10 items)
- **Default**: 20 items per page
- **Max**: 100 items per page

### Filtering
- **Method**: Query parameters with PostgREST operators
- **Operators**: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `in`, `is`, `not`
- **Example**: `?status=eq.active&created_at=gte.2024-01-01`
- **Multiple Values**: `?id=in.(1,2,3)`

### Sorting
- **Method**: `order` query parameter
- **Format**: `?order={column}.{direction}`
- **Direction**: `asc` or `desc`
- **Multiple**: `?order=created_at.desc,status.asc`

### Field Selection
- **Method**: `select` query parameter
- **Format**: `?select=column1,column2,relation(*)`
- **Nested**: `?select=id,name,contact(id,email,phone)`
- **All**: `?select=*` (default)

### ID Format
- **Primary Keys**: UUID (using `gen_random_uuid()`)
- **Foreign Keys**: UUID references
- **Legacy Tables**: BIGSERIAL where needed for backward compatibility
- **Display**: UUIDs shown in UI as-is (consider truncation for better UX)

### Timestamps
- **Format**: ISO 8601 (TIMESTAMPTZ in PostgreSQL)
- **Columns**: All tables include `created_at`, `updated_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW())
- **Timezone**: UTC stored, converted in client for display
- **Updates**: `updated_at` automatically updated via trigger

### Soft Deletes
- **Method**: `deleted_at` column (TIMESTAMPTZ, nullable)
- **Default**: `NULL` (not deleted)
- **RLS**: Automatically filters out records where `deleted_at IS NOT NULL`
- **Recovery**: Set `deleted_at = NULL` to restore
- **Hard Deletes**: Only for system cleanup, logged in audit_logs

### Response Format
**Success Response:**
```json
[
  {
    "id": "uuid",
    "field1": "value1",
    "field2": "value2",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

**Count Header:**
- `Content-Range: {start}-{end}/{total}`

**Error Response:**
```json
{
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": "Additional error details (optional)"
}
```

**HTTP Status Codes:**
- `200`: Success (GET, PATCH)
- `201`: Created (POST)
- `204`: No Content (DELETE)
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (RLS policy violation)
- `404`: Not Found
- `500`: Internal Server Error

### Error Handling
- **Client-Side**: Check `error` object in Supabase response
- **Server-Side**: Log errors in Edge Functions, return appropriate status codes
- **Validation**: Client-side validation, server-side enforcement via database constraints

### Real-time Subscriptions
- **Method**: Supabase Realtime via WebSocket
- **Format**: `supabase.channel('table-name').on('postgres_changes', {...})`
- **Events**: `INSERT`, `UPDATE`, `DELETE`
- **Filter**: Filter by RLS policies automatically

## Rationale
1. **PostgREST Standards**: Follows PostgREST conventions for consistency
2. **UUIDs**: Better for distributed systems, no sequential ID exposure
3. **Soft Deletes**: Preserve data for audit and recovery
4. **UTC Timestamps**: Avoid timezone confusion
5. **RLS Integration**: Automatic filtering of deleted records

## Consequences

### Positive
- Consistent API usage across all modules
- Automatic security via RLS
- Built-in filtering, sorting, pagination
- Real-time updates out of the box

### Negative
- Learning curve for PostgREST syntax
- Some limitations vs. custom REST APIs
- UUIDs are longer than sequential IDs

### Mitigations
- Documentation and examples for common patterns
- Helper functions for common queries
- Consider truncated UUIDs in UI for better UX

## Examples

### Create a Deal
```javascript
const { data, error } = await supabase
  .from('deals')
  .insert({
    title: 'New Deal',
    value: 10000,
    stage: 'prospecting',
    contact_id: 'uuid-here'
  })
  .select()
  .single();
```

### Query with Filtering and Pagination
```javascript
const { data, error, count } = await supabase
  .from('deals')
  .select('*, contact(id, name, email)', { count: 'exact' })
  .eq('status', 'active')
  .gte('value', 5000)
  .order('created_at', { ascending: false })
  .range(0, 19);
```

### Soft Delete
```javascript
const { data, error } = await supabase
  .from('deals')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', dealId);
```

### Real-time Subscription
```javascript
const subscription = supabase
  .channel('deals')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'deals',
    filter: `assigned_to=eq.${userId}`
  }, (payload) => {
    console.log('Change received!', payload);
  })
  .subscribe();
```

## Related ADRs
- ADR-001: Technology Stack Decisions
- ADR-003: Event Logging Strategy
- ADR-004: Domain Model Boundaries
