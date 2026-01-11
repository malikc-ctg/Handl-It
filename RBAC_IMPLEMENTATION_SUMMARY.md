# RBAC and Audit Logging Implementation Summary

## Overview

Comprehensive role-based access control (RBAC) and audit logging system has been implemented for Sales Portal, Calls, Messages, and Routes with compliance guardrails.

## Implementation Files

### 1. Database Schema
- **`ADD_RBAC_AUDIT_LOGGING.sql`** - Main schema file containing:
  - Audit logs table and triggers
  - Sales Portal schema (deals, quotes)
  - Calls schema with consent enforcement
  - Routes schema with location tracking restrictions
  - RBAC helper functions
  - Audit logging functions
  - RLS policies for all tables
  - Compliance enforcement functions

- **`UPDATE_MESSAGES_RBAC.sql`** - Updates existing messages/conversations with enhanced RBAC

### 2. Client-Side Services
- **`js/rbac-service.js`** - Client-side utilities:
  - `getUserRole()` - Get current user's role
  - `hasRole(roles)` - Check if user has role(s)
  - `assertPermission(action, resource)` - Assert permission (throws on failure)
  - `checkPermission(action, resource)` - Check permission (returns result)
  - `emitAuditLog(...)` - Manually log audit events
  - `checkCallConsent(...)` - Verify call consent
  - `checkLocationTrackingAllowed(...)` - Verify location tracking permission
  - `getPermissionErrorMessage(error)` - Get user-friendly error messages

### 3. Server-Side Middleware
- **`supabase/functions/_shared/rbac-middleware.ts`** - Edge function middleware:
  - `authenticateRequest(req)` - Authenticate and get user context
  - `requireAuth(context)` - Require authentication
  - `requireRole(context, roles)` - Require specific role(s)
  - `checkResourceAccess(...)` - Check resource-level access
  - `checkCallConsent(...)` - Verify call consent
  - `checkLocationTrackingAllowed(...)` - Verify location tracking
  - `emitAuditLog(...)` - Log audit events
  - `errorResponse(...)` / `successResponse(...)` - Standardized responses

### 4. Example Edge Function
- **`supabase/functions/store-call-recording/index.ts`** - Example showing:
  - Authentication and authorization
  - Consent verification
  - Resource access checks
  - Audit logging
  - Error handling

### 5. Documentation
- **`docs/SECURITY_COMPLIANCE.md`** - Comprehensive documentation covering:
  - Roles and permissions matrix
  - RBAC implementation details
  - Audit logging structure
  - Compliance guardrails
  - API endpoint protection
  - Configuration points
  - Error messages
  - Security best practices

### 6. Tests
- **`tests/rbac-compliance.test.js`** - Test suite covering:
  - Role-based access control
  - Call consent enforcement
  - Location tracking restrictions
  - Audit logging
  - Permission error messages

## Key Features

### ✅ Role-Based Access Control

**Roles:**
- `admin` - Full system access
- `manager` - Team access, quote approval
- `worker/rep` - Assigned resources access

**Permissions:**
- Deals: Read/write by assignment + role
- Quotes: Reps create, managers approve, admins override
- Calls: Reps see own + assigned deals; managers see team; admins see all
- Messages: Reps see own + assigned deals; managers see team; admins see all
- Routes: Reps access own; managers view team; admins all

### ✅ Audit Logging

**Automatically logged actions:**
- Deal stage changes
- Deal win/loss reason changes
- Quote send/accept/reject
- Call recording access
- Route start/stop
- Route location permission changes

**Audit log access:**
- Only `admin` role can view audit logs
- All sensitive actions are automatically logged via triggers

### ✅ Compliance Guardrails

**Call Recordings/Transcripts:**
- ❌ **BLOCKED**: Storing without `recording_consent = TRUE` or `transcript_consent = TRUE`
- ✅ **ALLOWED**: Only when consent flags are enabled
- Enforced at database RLS level, not just UI

**Location Tracking:**
- ❌ **BLOCKED**: Recording location when route is not `active`
- ❌ **BLOCKED**: Recording location when `location_tracking_enabled = FALSE`
- ❌ **BLOCKED**: Recording location for routes not assigned to user
- ✅ **ALLOWED**: Only during active route sessions with tracking enabled

### ✅ Error Messages

User-friendly error messages (not legal advice):
- `"Cannot store recording/transcript: Consent not provided by participant."`
- `"Location tracking is only allowed during active route sessions."`
- `"Permission denied: Cannot write deal {id}"`
- `"Forbidden: Requires role: manager"`

## Setup Instructions

### 1. Run Database Schema

Execute the SQL files in Supabase SQL Editor:

```bash
# 1. Main RBAC schema
ADD_RBAC_AUDIT_LOGGING.sql

# 2. Update messages RBAC
UPDATE_MESSAGES_RBAC.sql
```

### 2. Deploy Edge Function Middleware

The middleware is already in place at:
```
supabase/functions/_shared/rbac-middleware.ts
```

### 3. Use Client-Side Services

Import and use in your JavaScript:

```javascript
import * as rbac from './js/rbac-service.js'

// Check permission before action
try {
  await rbac.assertPermission('quote.approve', { id: quoteId })
  // Proceed with approval
} catch (error) {
  alert(rbac.getPermissionErrorMessage(error))
}
```

### 4. Use in Edge Functions

```typescript
import {
  authenticateRequest,
  requireAuth,
  requireRole,
  checkCallConsent,
  emitAuditLog,
} from '../_shared/rbac-middleware.ts'

const context = requireAuth(await authenticateRequest(req))
requireRole(context, ['admin', 'manager'])

const hasConsent = await checkCallConsent(supabase, callId, 'recording')
if (!hasConsent) {
  return errorResponse('Consent not provided', 403)
}
```

## Testing

Run the test suite:

```bash
deno test --allow-net --allow-env tests/rbac-compliance.test.js
```

Or use your preferred Node.js test runner (Jest, Vitest, etc.)

## Role Alignment Note

The existing system uses roles: `admin`, `manager`, `worker`

The implementation supports both `worker` and `rep` (they are treated as equivalent). If you want to use `rep` specifically, update the schema:

```sql
-- Update role check to include 'rep'
ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('admin', 'manager', 'worker', 'rep'));
```

## Next Steps

1. ✅ Run `ADD_RBAC_AUDIT_LOGGING.sql` in Supabase
2. ✅ Run `UPDATE_MESSAGES_RBAC.sql` in Supabase
3. ✅ Test permission checks in your application
4. ✅ Implement UI error handling using `getPermissionErrorMessage()`
5. ✅ Deploy edge functions using the middleware
6. ✅ Monitor audit logs regularly

## Acceptance Criteria Status

- ✅ All new endpoints protected by RBAC
- ✅ Audit logs created for sensitive events
- ✅ Consent + location gating enforced at service layer (not only UI)
- ✅ No questions asked (implementation complete)
- ✅ PR with middleware, policies, tests, docs

## Files Delivered

1. `ADD_RBAC_AUDIT_LOGGING.sql` - Main schema (600+ lines)
2. `UPDATE_MESSAGES_RBAC.sql` - Messages RBAC update
3. `js/rbac-service.js` - Client-side utilities
4. `supabase/functions/_shared/rbac-middleware.ts` - Server middleware
5. `supabase/functions/store-call-recording/index.ts` - Example function
6. `docs/SECURITY_COMPLIANCE.md` - Comprehensive documentation
7. `tests/rbac-compliance.test.js` - Test suite
8. `RBAC_IMPLEMENTATION_SUMMARY.md` - This file

## Support

Refer to `docs/SECURITY_COMPLIANCE.md` for detailed information about:
- Permission matrix
- API usage examples
- Configuration options
- Error handling
- Security best practices
