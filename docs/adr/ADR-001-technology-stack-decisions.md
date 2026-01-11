# ADR-001: Technology Stack Decisions

## Status
Accepted

## Context
NFG/Handl.it requires a modern, scalable architecture to support Sales Portal, Call Tracker (Quo), and Door-to-Door Route Management features. The application needs to support web and mobile clients, real-time updates, offline functionality, and comprehensive audit logging.

## Decision
We have chosen the following technology stack:

### Backend
- **Supabase** as the backend-as-a-service platform, providing:
  - PostgreSQL database with Row Level Security (RLS)
  - PostgREST REST API layer
  - Supabase Auth for authentication
  - Edge Functions for serverless compute (Deno/TypeScript)
  - Real-time subscriptions via WebSocket
  - Storage for files and media

### Frontend
- **Vanilla HTML/JavaScript** (ES6+ modules) for the web application
- **Tailwind CSS** for styling
- **Progressive Web App (PWA)** approach for mobile support
- **No build system** - served directly via CDN for simplicity

### Background Jobs
- **pg_cron** (PostgreSQL cron extension) for scheduled tasks
- **Edge Functions** for complex background processing

### CI/CD
- **GitHub Actions** for continuous integration
- **Vercel** for frontend deployment
- **Supabase** for backend deployment

## Rationale

### Why Supabase?
1. **Rapid Development**: PostgREST auto-generates REST API from database schema
2. **Security**: Built-in Row Level Security (RLS) for multi-tenancy and access control
3. **Real-time**: Native WebSocket support for live updates
4. **Scalability**: Managed infrastructure scales automatically
5. **Developer Experience**: Excellent tooling and documentation
6. **Cost**: Cost-effective for startups, scales with usage

### Why Vanilla JavaScript?
1. **Simplicity**: No build step, faster iteration
2. **Performance**: Smaller bundle size, faster load times
3. **Flexibility**: Easy to integrate third-party libraries via ES modules
4. **Maintainability**: Straightforward codebase without framework abstractions

### Why PWA Instead of Native Apps?
1. **Single Codebase**: One codebase for web and mobile
2. **Faster Development**: No need to maintain separate iOS/Android apps
3. **Easy Deployment**: Update without app store approval
4. **Cost-Effective**: No need for separate mobile development team
5. **Offline Support**: Service Workers provide offline functionality

### Why pg_cron?
1. **Database-Native**: Jobs execute within database context
2. **Reliable**: Leverages PostgreSQL's reliability
3. **Simple**: No external job queue needed for basic tasks
4. **Transactional**: Can participate in database transactions

## Consequences

### Positive
- Fast development and iteration
- Built-in security and multi-tenancy
- Real-time capabilities out of the box
- Cost-effective for startup stage
- Good developer experience

### Negative
- Vendor lock-in to Supabase (mitigated by open-source PostgreSQL)
- Limited control over infrastructure
- Edge Functions have 60-second timeout limit
- PWA limitations compared to native apps (can be addressed later)

### Mitigations
- **Vendor Lock-in**: Keep database schema SQL-based for easy migration
- **Infrastructure Control**: Can migrate to self-hosted PostgREST if needed
- **Timeout Limits**: Break long-running tasks into smaller chunks
- **PWA Limitations**: Can develop native apps later if needed

## Alternatives Considered

### Backend Alternatives
- **Node.js + Express + PostgreSQL**: More control, but more boilerplate
- **Firebase**: Similar to Supabase, but less SQL-focused
- **AWS Amplify**: More complex, steeper learning curve

### Frontend Alternatives
- **React/Vue/Svelte**: More structure, but adds complexity and build step
- **Next.js/Nuxt**: Overkill for current needs, adds complexity

### Background Job Alternatives
- **Bull/BullMQ**: More features, but requires Redis infrastructure
- **Celery**: Python-based, would require separate service
- **AWS SQS**: More complex, requires AWS infrastructure

## Notes
- This decision was made considering the current stage of the application (startup/early growth)
- The stack can evolve as the application scales
- Migration paths exist for all major components if needed

## Related ADRs
- ADR-002: API Conventions
- ADR-003: Event Logging Strategy
- ADR-004: Domain Model Boundaries
