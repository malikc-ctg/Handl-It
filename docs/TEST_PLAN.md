# Test Plan - NFG App V3

## Overview

This document outlines the comprehensive test plan for the NFG App V3, covering unit tests, integration tests, and end-to-end tests for critical business flows.

## Testing Stack

- **Unit/Integration Tests**: Vitest
- **E2E Tests**: Playwright
- **Linting**: ESLint
- **Type Checking**: TypeScript (checkJs mode)

## Test Structure

```
tests/
├── fixtures/
│   └── factories.js          # Test data factories
├── unit/
│   ├── rbac.test.js          # RBAC enforcement tests
│   └── consent-gating.test.js # Consent/location gating tests
├── integration/
│   └── quo-webhook.test.js   # Webhook integration tests
└── e2e/
    ├── sales-portal-flow.spec.js  # Sales flow E2E
    └── route-flow.spec.js         # Route flow E2E
```

## Test Coverage Areas

### 1. Sales Portal Core Flows

**Flow**: Rep creates lead/deal → calls → webhook logs call → summary → next action → quote → send → accept → win

**Test Cases**:
- ✅ Lead/deal (site) creation
- ✅ Call webhook ingestion with idempotency
- ✅ Automatic phone number linking to sites
- ✅ Call summary generation (AI)
- ✅ Next action suggestion and task creation
- ✅ Quote creation and sending
- ✅ Quote acceptance workflow
- ✅ Deal win tracking

**Files**:
- `tests/e2e/sales-portal-flow.spec.js`

### 2. Quo Webhook Ingestion

**Flow**: Webhook received → idempotency check → phone matching → site linking → call record creation

**Test Cases**:
- ✅ Idempotency: duplicate webhooks return same call_id
- ✅ Phone number normalization (E.164 format)
- ✅ Automatic site linking via phone match
- ✅ Contact mapping creation
- ✅ Consent-gated data handling (transcript/recording)
- ✅ Error handling and retry logic

**Files**:
- `tests/integration/quo-webhook.test.js`
- `supabase/functions/quo-webhook/index.ts`

### 3. Quote Creation and Sending

**Flow**: Create quote → generate PDF → send email → track opens → handle acceptance

**Test Cases**:
- ✅ Quote creation from job/site
- ✅ PDF generation
- ✅ Email sending with tracking
- ✅ Quote acceptance workflow
- ✅ Quote expiration handling
- ✅ Conversion to booking/job

**Status**: Quote system not yet implemented - tests are placeholders

### 4. Follow-up Sequences Stop Rules

**Flow**: Trigger condition → check stop rules → create/update follow-up task

**Test Cases**:
- ✅ Stop rule: "Quote accepted" → stop sequence
- ✅ Stop rule: "Deal won" → stop sequence
- ✅ Stop rule: "Unsubscribed" → stop sequence
- ✅ Follow-up task creation based on sequence
- ✅ Task scheduling and reminders

**Status**: Follow-up sequences not yet implemented - tests are placeholders

### 5. Route Start/Stop and Door Outcomes Sync

**Flow**: Route create → start → door outcomes → appointment set → lead created → follow-up task created

**Test Cases**:
- ✅ Route creation with stops
- ✅ Route start tracking
- ✅ Door outcome recording (answered, not_home, no_answer, etc.)
- ✅ Appointment scheduling from outcome
- ✅ Automatic lead/site creation from appointment
- ✅ Follow-up task auto-creation
- ✅ Route completion and sync

**Files**:
- `tests/e2e/route-flow.spec.js`

### 6. RBAC Enforcement

**Flow**: User action → RLS policy check → allow/deny

**Test Cases**:
- ✅ Admin: Full access to all resources
- ✅ Client: Access to own sites/jobs only
- ✅ Staff: Access to assigned jobs only
- ✅ Job visibility based on role
- ✅ Site creation restrictions
- ✅ User management permissions

**Files**:
- `tests/unit/rbac.test.js`

### 7. Consent and Location Gating

**Flow**: Data access → consent check → location validation → allow/deny

**Test Cases**:
- ✅ Transcript storage requires consent
- ✅ Recording URL storage requires consent
- ✅ Phone number normalization (E.164)
- ✅ Raw phone number storage for display
- ✅ Consent-based data retention
- ✅ Location-based access restrictions

**Files**:
- `tests/unit/consent-gating.test.js`

## Test Fixtures and Factories

All test data is created via factories in `tests/fixtures/factories.js`:

- `createTestUser()` - Creates user with role
- `createTestSite()` - Creates site (lead/deal)
- `createTestJob()` - Creates job
- `createTestBooking()` - Creates booking
- `createTestCall()` - Creates call record
- `createTestQuote()` - Creates quote (when implemented)
- `createTestWebhookLog()` - Creates webhook log
- `cleanupTestData()` - Cleans up test data

## CI/CD Integration

### GitHub Actions Workflow

The CI pipeline (`.github/workflows/ci.yml`) runs on every push/PR:

1. **Lint**: ESLint checks code quality
2. **Typecheck**: TypeScript type checking
3. **Unit Tests**: Vitest runs unit/integration tests
4. **E2E Tests**: Playwright runs end-to-end tests
5. **Artifacts**: Test results and coverage uploaded

### Gating

All checks must pass before merge:
- ✅ Lint passes
- ✅ Typecheck passes
- ✅ All unit tests pass
- ✅ All E2E tests pass

## Observability

### Structured Logging

All webhook handlers and job processors use structured logging:

```javascript
{
  level: 'info' | 'warn' | 'error',
  message: 'Human-readable message',
  event_type: 'call.ended',
  call_id: 'quo-123',
  timestamp: '2025-01-20T10:00:00Z',
  metadata: { ... }
}
```

**Implementation**:
- `supabase/functions/quo-webhook/index.ts` - Structured logs for webhooks
- Job processors should use same format

### Error Reporting

Error reporting hooks should be added for:
- Unhandled exceptions in Edge Functions
- Failed webhook processing
- Job processing errors
- Database constraint violations

**Recommended**: Integrate with Sentry or similar service

## Running Tests

### Local Development

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run unit tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run all checks (lint + typecheck + tests)
npm run ci
```

### CI Environment

Tests run automatically on:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`

## Test Data Management

### Test Database

- Use separate Supabase project for testing
- Or use test schema with cleanup
- All test data should be cleaned up after tests

### Environment Variables

Required for tests:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for admin operations)

## Acceptance Criteria

✅ **Tests fail before fixes and pass after**
- All tests initially written to fail (red)
- Fix implementation to make tests pass (green)
- Refactor while keeping tests green

✅ **CI blocks regressions**
- CI pipeline runs on every PR
- All checks must pass before merge
- Failed tests block deployment

✅ **No questions asked**
- All test scenarios are self-contained
- No manual intervention required
- Tests are deterministic and repeatable

## Future Enhancements

1. **Quote System Tests**: Implement when quote feature is added
2. **Follow-up Sequences Tests**: Implement when sequences are added
3. **Performance Tests**: Add load testing for webhook endpoints
4. **Visual Regression Tests**: Add screenshot comparison for UI
5. **Accessibility Tests**: Add a11y checks
6. **Security Tests**: Add penetration testing for webhooks

## Maintenance

- Update tests when features change
- Add tests for new features before implementation (TDD)
- Review test coverage regularly
- Keep test data factories in sync with schema changes
