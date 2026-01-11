# Security & Compliance Documentation

## Overview

This document outlines the role-based access control (RBAC), audit logging, and compliance features implemented in the NFG application for Sales Portal, Calls, Messages, and Routes.

## Table of Contents

1. [Roles and Permissions](#roles-and-permissions)
2. [RBAC Implementation](#rbac-implementation)
3. [Audit Logging](#audit-logging)
4. [Compliance Guardrails](#compliance-guardrails)
5. [API Endpoints Protection](#api-endpoints-protection)
6. [Configuration Points](#configuration-points)
7. [Error Messages](#error-messages)

---

## Roles and Permissions

### Role Hierarchy

1. **admin** - Full system access, can view all resources and audit logs
2. **manager** - Can view team resources, approve quotes, manage team routes
3. **worker/rep** - Can access assigned resources, create quotes, manage own routes

### Permission Matrix

| Resource | Action | admin | manager | rep/worker |
|----------|--------|-------|---------|------------|
| **Deals** | Read | ✅ All | ✅ Team + Own | ✅ Assigned + Own |
| **Deals** | Write | ✅ All | ✅ Team + Own | ✅ Assigned + Own |
| **Quotes** | Create | ✅ | ✅ | ✅ |
| **Quotes** | Approve | ✅ | ✅ Optional | ❌ |
| **Quotes** | Override | ✅ | ❌ | ❌ |
| **Calls** | View | ✅ All | ✅ Team | ✅ Own + Assigned Deals |
| **Messages** | View | ✅ All | ✅ Team | ✅ Own + Assigned Deals |
| **Routes** | View | ✅ All | ✅ Team | ✅ Own |
| **Routes** | Manage | ✅ All | ✅ Team | ✅ Own |
| **Audit Logs** | View | ✅ | ❌ | ❌ |

---

## RBAC Implementation

### Database-Level (RLS Policies)

All sensitive tables have Row Level Security (RLS) enabled with policies that enforce:

- **Deals**: Access based on assignment and role
- **Quotes**: Access based on deal assignment; approval workflow by role
- **Calls**: Access based on caller, deal assignment, and role
- **Messages**: Access based on conversation participation and role
- **Routes**: Access based on assignment and role

### Application-Level (Service Functions)

Client-side and server-side utilities provide:

- `assertPermission(action, resource)` - Assert permission before action
- `checkPermission(action, resource)` - Check permission (non-throwing)
- `getUserRole()` - Get current user's role
- `hasRole(roles)` - Check if user has specific role(s)

### Edge Function Middleware

API endpoints use middleware functions:

- `authenticateRequest(req)` - Authenticate and get user context
- `requireAuth(context)` - Require authentication
- `requireRole(context, roles)` - Require specific role(s)
- `checkResourceAccess(...)` - Check resource-level access

---

## Audit Logging

### Logged Actions

The system automatically logs sensitive actions:

#### Deal Actions
- `deal.stage_change` - When deal stage changes
- `deal.win_loss_reason_change` - When win/loss reason is updated

#### Quote Actions
- `quote.send` - When quote is sent
- `quote.accept` - When quote is accepted
- `quote.reject` - When quote is rejected
- `quote.status_change` - Other status changes

#### Call Actions
- `call.recording_access` - When recording is uploaded/accessed

#### Route Actions
- `route.start` - When route is started
- `route.stop` - When route is completed/cancelled
- `route.location_permission_change` - When location tracking is enabled/disabled

### Audit Log Structure

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  actor_id UUID NOT NULL,           -- User who performed action
  target_type VARCHAR(50),          -- 'deal', 'quote', 'call', etc.
  target_id UUID,                   -- Resource ID
  before_state JSONB,               -- State before action
  after_state JSONB,                -- State after action
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,                   -- Additional context
  created_at TIMESTAMPTZ NOT NULL
);
```

### Viewing Audit Logs

Only users with `admin` role can view audit logs:

```sql
SELECT * FROM audit_logs
WHERE action = 'deal.stage_change'
ORDER BY created_at DESC;
```

### Manual Audit Logging

To manually log an action:

```javascript
import { emitAuditLog } from './js/rbac-service.js';

await emitAuditLog(
  'custom.action',
  'deal',
  dealId,
  { stage: 'old_stage' },
  { stage: 'new_stage' },
  { additional: 'context' }
);
```

---

## Compliance Guardrails

### 1. Call Recording/Transcript Consent

**Requirement**: Do not store call recordings or transcripts unless consent flag is enabled.

**Implementation**:

1. **Database Constraint**: `calls.recording_consent` and `calls.transcript_consent` must be `TRUE` before storing.

2. **RLS Policy**: `call_recordings` and `call_transcripts` tables only allow INSERT if consent is enabled:

```sql
WITH CHECK (
  EXISTS (
    SELECT 1 FROM calls c
    WHERE c.id = call_recordings.call_id
    AND c.recording_consent = TRUE  -- Consent required
  )
)
```

3. **Service Function**: `checkCallConsent(callId, consentType)` validates before storing.

4. **Error Message**: "Cannot store recording/transcript: Consent not provided by participant."

### 2. Location Tracking Restrictions

**Requirement**: Do not allow background location tracking outside an active route session.

**Implementation**:

1. **RLS Policy**: `route_locations` table only allows INSERT during active routes:

```sql
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM routes r
    WHERE r.id = route_locations.route_id
    AND r.status = 'active'                    -- Must be active
    AND r.location_tracking_enabled = TRUE    -- Tracking must be enabled
    AND r.assigned_to = auth.uid()            -- Must be assigned
  )
)
```

2. **Service Function**: `checkLocationTrackingAllowed(routeId)` validates before recording.

3. **Error Message**: "Location tracking is only allowed during active route sessions."

### Blocked Actions

The following actions are blocked at the service layer (not just UI):

- ❌ Storing call recording without `recording_consent = TRUE`
- ❌ Storing call transcript without `transcript_consent = TRUE`
- ❌ Recording location when route is not `active`
- ❌ Recording location when `location_tracking_enabled = FALSE`
- ❌ Recording location for routes not assigned to user

---

## API Endpoints Protection

### Edge Function Example

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  authenticateRequest,
  requireAuth,
  requireRole,
  checkResourceAccess,
  checkCallConsent,
  emitAuditLog,
  errorResponse,
  successResponse,
  handleCORS,
} from '../_shared/rbac-middleware.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Handle CORS
  const cors = handleCORS(req)
  if (cors) return cors

  try {
    // Authenticate
    const context = requireAuth(await authenticateRequest(req))
    
    // Check role (if needed)
    requireRole(context, ['admin', 'manager', 'rep'])
    
    // Get Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const { callId, recordingUrl } = await req.json()
    
    // Check consent before storing
    const hasConsent = await checkCallConsent(supabase, callId, 'recording')
    if (!hasConsent) {
      return errorResponse(
        'Cannot store recording: Consent not provided by participant.',
        403
      )
    }
    
    // Store recording
    const { data, error } = await supabase
      .from('call_recordings')
      .insert({
        call_id: callId,
        recording_url: recordingUrl,
        consent_verified: true
      })
    
    if (error) throw error
    
    // Log action
    await emitAuditLog(
      supabase,
      'call.recording_access',
      context.userId!,
      'call',
      callId,
      null,
      { recording_id: data.id }
    )
    
    return successResponse({ success: true })
    
  } catch (error) {
    return errorResponse(error.message, 403)
  }
})
```

### Protected Endpoints

All new endpoints should:

1. Use `authenticateRequest()` to verify authentication
2. Use `requireRole()` for role-based checks
3. Use `checkResourceAccess()` for resource-level checks
4. Use consent/location checks before sensitive operations
5. Use `emitAuditLog()` for sensitive actions

---

## Configuration Points

### Role Management

Roles are stored in `user_profiles.role`:

```sql
ALTER TABLE user_profiles
ALTER COLUMN role SET DEFAULT 'worker';

-- Valid roles: 'admin', 'manager', 'worker', 'rep'
```

### Consent Flags

Enable consent when creating a call:

```javascript
const { data, error } = await supabase
  .from('calls')
  .insert({
    caller_id: userId,
    deal_id: dealId,
    recording_consent: true,  // Enable recording consent
    transcript_consent: true  // Enable transcript consent
  })
```

### Location Tracking

Enable location tracking when starting a route:

```javascript
const { data, error } = await supabase
  .from('routes')
  .update({
    status: 'active',
    started_at: new Date().toISOString(),
    location_tracking_enabled: true  // Enable tracking
  })
  .eq('id', routeId)
```

### Team Membership

Team membership is determined by:

1. Same site assignments (`worker_site_assignments`)
2. Direct team relationships (can be extended with `teams` table)

To extend team membership:

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY,
  manager_id UUID REFERENCES auth.users(id),
  member_id UUID REFERENCES auth.users(id),
  UNIQUE(manager_id, member_id)
);

-- Update is_team_member() function to check teams table
```

---

## Error Messages

All permission and compliance errors return user-friendly messages:

### Permission Errors

- `"Unauthorized: Authentication required"` - User not authenticated
- `"Forbidden: Requires role: admin"` - Role requirement not met
- `"Permission denied: Cannot write deal {id}"` - Resource access denied

### Compliance Errors

- `"Cannot store recording/transcript: Consent not provided by participant."` - Missing consent
- `"Location tracking is only allowed during active route sessions."` - Location tracking violation

### Usage

```javascript
import { assertPermission, getPermissionErrorMessage } from './js/rbac-service.js'

try {
  await assertPermission('quote.approve', { id: quoteId })
  // Proceed with approval
} catch (error) {
  const message = getPermissionErrorMessage(error)
  // Show message to user
  alert(message)
}
```

---

## Testing

### Manual Testing

1. **Test Permission Checks**:
   ```javascript
   // As rep, try to approve quote
   await assertPermission('quote.approve', { id: quoteId })
   // Should throw: "Forbidden: Requires role: manager"
   ```

2. **Test Consent Enforcement**:
   ```javascript
   // Try to store recording without consent
   await supabase.from('call_recordings').insert({
     call_id: callId,  // call has recording_consent = FALSE
     recording_url: '...'
   })
   // Should fail with RLS policy error
   ```

3. **Test Location Tracking**:
   ```javascript
   // Try to record location when route is not active
   await supabase.from('route_locations').insert({
     route_id: routeId,  // route.status = 'planned'
     latitude: 43.65,
     longitude: -79.38
   })
   // Should fail with RLS policy error
   ```

### Automated Tests

See `tests/rbac-compliance.test.js` for comprehensive test suite.

---

## Security Best Practices

1. **Never trust client-side checks alone** - Always verify on server/RLS
2. **Use RLS policies** for all sensitive tables
3. **Log sensitive actions** via audit logs
4. **Enforce consent** at database level, not just UI
5. **Validate inputs** before processing
6. **Use parameterized queries** to prevent SQL injection
7. **Monitor audit logs** regularly for suspicious activity

---

## Support

For questions or issues related to security and compliance:

1. Review this documentation
2. Check audit logs for blocked actions
3. Verify RLS policies are enabled
4. Contact system administrator
