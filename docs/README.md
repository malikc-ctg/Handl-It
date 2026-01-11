# NFG/Handl.it Documentation

This directory contains all technical documentation for the NFG/Handl.it application.

## Documents

### Core Documentation
- **[FEATURES.md](./FEATURES.md)**: Complete feature set for Sales Portal, Call Tracker (Quo), and Door-to-Door Route Management
- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: System architecture, modules, data flows, and technology stack
- **[WORKPLAN.md](./WORKPLAN.md)**: Engineering work plan with modules, owners, dependencies, and acceptance criteria

### Architecture Decision Records (ADRs)
Located in the [`/docs/adr`](./adr/) directory:

- **[ADR-001: Technology Stack Decisions](./adr/ADR-001-technology-stack-decisions.md)**: Backend (Supabase), Frontend (Vanilla JS), Mobile (PWA), Background Jobs (pg_cron)
- **[ADR-002: API Conventions](./adr/ADR-002-api-conventions.md)**: REST API conventions, error handling, pagination, IDs, timestamps, soft deletes
- **[ADR-003: Event Logging Strategy](./adr/ADR-003-event-logging-strategy.md)**: "Everything is an event" - dual logging system (event_logs, audit_logs)
- **[ADR-004: Domain Model Boundaries](./adr/ADR-004-domain-model-boundaries.md)**: Domain objects, relationships, data integrity rules, naming conventions

## Quick Start

### For Developers
1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) to understand the system architecture
2. Review [WORKPLAN.md](./WORKPLAN.md) to see the implementation plan
3. Check ADRs for key architectural decisions
4. Refer to [FEATURES.md](./FEATURES.md) for feature requirements

### For Product Managers
1. Read [FEATURES.md](./FEATURES.md) for complete feature specifications
2. Review [WORKPLAN.md](./WORKPLAN.md) for timeline and dependencies

### For Security Engineers
1. Review [ADR-003: Event Logging Strategy](./adr/ADR-003-event-logging-strategy.md) for audit logging
2. Check [WORKPLAN.md](./WORKPLAN.md) Module 9 for permissions and compliance

## Technology Stack

- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Frontend**: Vanilla HTML/JavaScript (ES6+ modules)
- **Mobile**: Progressive Web App (PWA)
- **Database**: PostgreSQL 15+ with Row Level Security (RLS)
- **Authentication**: Supabase Auth (JWT-based)
- **CI/CD**: GitHub Actions
- **Testing**: Vitest (unit), Playwright (E2E)

## Domain Model

### Core Objects
- **Leads**: Potential customers (unqualified)
- **Deals**: Sales opportunities with value, stage, probability
- **Contacts**: Individual people in the sales process
- **Companies**: Organizations (customers/prospects)
- **Quotes**: Price proposals sent to contacts/companies
- **Activities**: Time-bound events (calls, emails, meetings, tasks, notes)
- **Calls**: Telephone call records (linked to Activities)
- **Routes**: Planned door-to-door routes for sales reps
- **Doors**: Individual doors/locations to visit in routes
- **Tasks**: Action items assigned to users
- **Sequences**: Automated follow-up sequences

See [ADR-004: Domain Model Boundaries](./adr/ADR-004-domain-model-boundaries.md) for detailed definitions and relationships.

## API Conventions

- **Base URL**: `https://{project}.supabase.co/rest/v1/{table}`
- **Authentication**: Bearer token in `Authorization` header
- **Pagination**: `Range` header (e.g., `Range: 0-9`)
- **Filtering**: Query parameters (e.g., `?status=eq.active`)
- **Sorting**: `order` parameter (e.g., `?order=created_at.desc`)
- **IDs**: UUID format (gen_random_uuid())
- **Timestamps**: ISO 8601 (TIMESTAMPTZ), UTC stored
- **Soft Deletes**: `deleted_at` column (nullable TIMESTAMPTZ)

See [ADR-002: API Conventions](./adr/ADR-002-api-conventions.md) for complete API specifications.

## Event Logging

All significant events are logged to two tables:

1. **event_logs**: Structured events for AI/ML and analytics
2. **audit_logs**: Comprehensive audit trail for compliance

Event naming: `{entity_type}.{action_type}` (e.g., `deal.created`, `call.completed`)

See [ADR-003: Event Logging Strategy](./adr/ADR-003-event-logging-strategy.md) for complete event taxonomy.

## Development Workflow

### Local Development
```bash
# Install dependencies
npm ci

# Run linter
npm run lint

# Run type checker
npm run typecheck

# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e

# Run full CI pipeline
npm run ci
```

### CI/CD Pipeline
GitHub Actions automatically runs on push/PR to `main` or `develop`:
- Lint (ESLint)
- Type check (TypeScript)
- Unit tests (Vitest)
- E2E tests (Playwright)

See `.github/workflows/ci.yml` for configuration.

## Adding New Features

1. **Create/Update ADR**: Document architectural decisions in `/docs/adr/`
2. **Update WORKPLAN**: Add module to work plan with owner, dependencies, acceptance criteria
3. **Implement Feature**: Follow API conventions, event logging, domain model boundaries
4. **Write Tests**: Unit tests for logic, integration tests for API, E2E tests for flows
5. **Update Documentation**: Update FEATURES.md and ARCHITECTURE.md as needed

## Questions?

- Technical questions: See ADRs for architectural decisions
- Feature questions: See FEATURES.md for specifications
- Implementation questions: See WORKPLAN.md for work plan
- General questions: Contact Agent 01 (Tech Lead Integrator)
