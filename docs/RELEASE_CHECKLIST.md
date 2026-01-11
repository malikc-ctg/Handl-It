# Release Readiness Checklist

This document provides a comprehensive checklist to ensure the NFG/Handl.it application is ready for production release.

## 🔒 Security & Compliance

### Authentication & Authorization
- [ ] All endpoints require proper authentication
- [ ] RBAC policies enforced across all tables
- [ ] Super admin role properly configured and secured
- [ ] User roles standardized: `admin`, `client`, `staff`, `super_admin` (no `manager`/`worker` inconsistencies)
- [ ] RLS policies enabled and tested on all tables
- [ ] Service role key secured (never exposed to frontend)

### Consent & Privacy
- [ ] Consent gating implemented for transcript/recording storage
- [ ] `has_consent` flag checked before storing sensitive data
- [ ] Consent logs table populated for all consent changes
- [ ] Location tracking only enabled during active route sessions
- [ ] No location tracking outside active route sessions
- [ ] GDPR compliance: Users can export/delete their data

### Audit Logging
- [ ] Audit log system implemented (`audit_logs` table)
- [ ] Critical actions logged (create, update, delete, export, login)
- [ ] Consent changes logged in `consent_logs`
- [ ] Location tracking logged in `location_tracking_logs`
- [ ] Audit logs are immutable (only service role can insert)
- [ ] Retention policy configured for old logs

## 🗄️ Database & Migrations

### Migration Files
- [ ] All migration files are tracked in git
- [ ] Migration files follow naming convention: `ADD_*.sql`, `FIX_*.sql`
- [ ] No duplicate table definitions (e.g., `calls` table reconciled)
- [ ] All migrations are idempotent (can be run multiple times safely)
- [ ] Migrations apply cleanly on:
  - [ ] Fresh empty database
  - [ ] Existing production database
  - [ ] Development database with test data

### Schema Consistency
- [ ] Single source of truth for enums (user_role, status types, etc.)
- [ ] All foreign keys properly defined
- [ ] Indexes created for frequently queried columns
- [ ] No circular dependencies between tables
- [ ] Schema conflicts resolved (e.g., calls table unified)

### Data Integrity
- [ ] Constraints enforce data validity (CHECK constraints, NOT NULL)
- [ ] Unique constraints prevent duplicates (e.g., `quo_call_id`)
- [ ] Cascade deletes configured appropriately
- [ ] Soft deletes implemented where needed (archived status)

## 🔄 API & Integration

### API Contract
- [ ] OpenAPI specification created (`docs/api-contract.yaml` or `docs/openapi.yaml`)
- [ ] All endpoints documented with request/response schemas
- [ ] Error response shape standardized across all endpoints
- [ ] Pagination standardized (consistent `limit`, `offset`, `total_count` format)
- [ ] Versioning strategy defined (if needed)

### Error Handling
- [ ] Consistent error response format:
  ```json
  {
    "error": {
      "code": "ERROR_CODE",
      "message": "Human-readable message",
      "details": {},
      "timestamp": "ISO8601"
    }
  }
  ```
- [ ] All errors properly logged in audit_logs
- [ ] Sensitive information not exposed in error messages

### Webhooks & Idempotency
- [ ] Webhook handlers are idempotent (use unique IDs to prevent duplicate processing)
- [ ] Quo webhook handler uses `quo_call_id` for idempotency
- [ ] Recurring billing cron job is idempotent (24-hour cooldown)
- [ ] Webhook payloads logged for debugging (with retention)

### Pagination
- [ ] All list endpoints support pagination
- [ ] Consistent pagination parameters: `limit`, `offset`, `page`
- [ ] Response includes `total_count` for client-side pagination
- [ ] Default limits set to prevent large queries (e.g., max 100 items)

## 🧪 Testing

### Test Coverage
- [ ] Unit tests for critical functions
- [ ] Integration tests for API endpoints
- [ ] E2E tests for primary user flows:
  - [ ] User authentication and authorization
  - [ ] Job creation and completion
  - [ ] Booking creation and auto-job creation
  - [ ] Inventory management
  - [ ] Site management
  - [ ] User invitation flow
- [ ] Test database seeded with sample data
- [ ] All tests pass in CI/CD pipeline

### Manual Testing
- [ ] All primary user flows tested manually
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsiveness tested
- [ ] Edge cases tested (empty states, error states, large datasets)

## 🔧 Configuration & Environment

### Environment Variables
- [ ] All secrets stored in Supabase secrets (not hardcoded)
- [ ] Environment variables documented (`docs/ENVIRONMENT.md`)
- [ ] `.env.example` file created (without secrets)
- [ ] Production/staging/development environments configured

### Edge Functions
- [ ] All Edge Functions deployed
- [ ] Edge Functions have proper error handling
- [ ] Edge Functions use service role key securely
- [ ] Edge Functions tested independently

### Third-Party Integrations
- [ ] Quo integration configured (API keys, webhook URL)
- [ ] Email service configured (Resend/Zoho)
- [ ] Payment gateway configured (Stripe)
- [ ] Storage buckets configured with proper RLS policies

## 📊 Performance & Scalability

### Database Performance
- [ ] Indexes created on frequently queried columns
- [ ] Query performance tested with realistic data volumes
- [ ] N+1 query problems identified and fixed
- [ ] Database connection pooling configured

### Frontend Performance
- [ ] Large lists paginated or virtualized
- [ ] Images optimized and lazy-loaded
- [ ] Code splitting implemented for large bundles
- [ ] Service worker configured for offline support (PWA)

## 📚 Documentation

### User Documentation
- [ ] README.md updated with setup instructions
- [ ] API documentation created
- [ ] Feature documentation created (`docs/FEATURES.md`)
- [ ] Deployment guide created

### Developer Documentation
- [ ] Architecture decision records (ADRs) documented
- [ ] Database schema documented
- [ ] Code style guide defined
- [ ] Contributing guidelines created

## 🚀 Deployment

### Pre-Deployment
- [ ] CI/CD pipeline configured and tested
- [ ] Database backups configured
- [ ] Rollback plan documented
- [ ] Monitoring and alerting configured

### Deployment Steps
1. [ ] Run database migrations on production
2. [ ] Deploy Edge Functions
3. [ ] Update frontend deployment
4. [ ] Verify environment variables set
5. [ ] Test critical flows on production
6. [ ] Monitor error logs and performance

### Post-Deployment
- [ ] Smoke tests passed
- [ ] Monitoring dashboards show healthy metrics
- [ ] Error rate within acceptable thresholds
- [ ] Performance metrics within SLA

## 🔍 Final Verification

### Security Audit
- [ ] No sensitive data in client-side code
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] CORS properly configured
- [ ] Rate limiting implemented (if applicable)

### Compliance Check
- [ ] GDPR requirements met (consent, data export, deletion)
- [ ] Audit logs capture all required events
- [ ] Retention policies configured per compliance requirements

### Integration Verification
- [ ] All webhooks responding correctly
- [ ] Email delivery working
- [ ] Payment processing working
- [ ] Third-party API integrations functional

## ✅ Sign-Off

- [ ] **Developer**: All code reviewed and tested
- [ ] **DevOps**: Deployment pipeline verified
- [ ] **Security**: Security audit completed
- [ ] **QA**: All test cases passed
- [ ] **Product**: Features meet requirements
- [ ] **Release Manager**: Final approval

---

## Notes

- This checklist should be reviewed before every release
- Items marked incomplete should block release
- Critical items (Security, Data Integrity) are non-negotiable
- Non-critical items can be tracked in post-release backlog

## Last Updated

Date: {{ CURRENT_DATE }}
Version: 1.0
