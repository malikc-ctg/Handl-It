# NFG/Handl.it - Architecture Documentation

## Overview

This document describes the architecture of the NFG/Handl.it application, including modules, data flows, technology stack, and design patterns.

---

## 1. Technology Stack

### 1.1 Backend
- **Framework**: Supabase (PostgreSQL + Edge Functions)
- **Database**: PostgreSQL 15+ with Row Level Security (RLS)
- **API Layer**: Supabase REST API + PostgREST
- **Authentication**: Supabase Auth (JWT-based)
- **Authorization**: Row Level Security (RLS) policies
- **Serverless Functions**: Supabase Edge Functions (Deno runtime, TypeScript)
- **Background Jobs**: pg_cron (PostgreSQL cron extension)
- **Storage**: Supabase Storage (S3-compatible)

### 1.2 Frontend
- **Framework**: Vanilla HTML/JavaScript (ES6+ modules)
- **UI Library**: Tailwind CSS
- **Build System**: None (served directly, or via CDN)
- **State Management**: Client-side JavaScript modules
- **Real-time**: Supabase Realtime (WebSocket-based)
- **PWA**: Progressive Web App with Service Worker

### 1.3 Mobile
- **Platform**: Progressive Web App (PWA)
- **Offline Support**: Service Worker + IndexedDB
- **Push Notifications**: Web Push API via Supabase
- **Native Features**: Camera API, Geolocation API, Storage API

### 1.4 DevOps & CI/CD
- **Hosting**: Vercel (frontend), Supabase (backend)
- **CI/CD**: GitHub Actions (to be configured)
- **Environment Management**: Environment variables via Supabase/Vercel
- **Monitoring**: Supabase Dashboard + custom logging

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Web    │  │  Mobile  │  │   PWA    │  │   Admin  │   │
│  │   App    │  │   App    │  │          │  │  Portal  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼──────────────┼──────────────┼──────────────┼─────────┘
        │              │              │              │
        └──────────────┼──────────────┼──────────────┘
                       │              │
        ┌──────────────▼──────────────▼──────────────┐
        │         Supabase Client Library             │
        │    (Authentication, Realtime, Storage)      │
        └──────────────┬──────────────┬──────────────┘
                       │              │
        ┌──────────────▼──────────────▼──────────────┐
        │            Supabase Platform                │
        │  ┌────────────┐  ┌──────────────────────┐ │
        │  │   Auth     │  │   PostgREST API      │ │
        │  │  (JWT)     │  │   (REST + RLS)       │ │
        │  └────────────┘  └──────────────────────┘ │
        │  ┌────────────┐  ┌──────────────────────┐ │
        │  │  Realtime  │  │  Edge Functions      │ │
        │  │ (WebSocket)│  │  (Deno/TypeScript)   │ │
        │  └────────────┘  └──────────────────────┘ │
        │  ┌────────────┐  ┌──────────────────────┐ │
        │  │  Storage   │  │  pg_cron (Jobs)      │ │
        │  │  (S3-like) │  │  (Scheduled Tasks)   │ │
        │  └────────────┘  └──────────────────────┘ │
        └──────────────┬──────────────────────────────┘
                       │
        ┌──────────────▼──────────────┐
        │      PostgreSQL Database     │
        │  ┌────────────────────────┐  │
        │  │  Row Level Security    │  │
        │  │  (RLS Policies)        │  │
        │  └────────────────────────┘  │
        │  ┌────────────────────────┐  │
        │  │  Triggers & Functions  │  │
        │  │  (Business Logic)      │  │
        │  └────────────────────────┘  │
        │  ┌────────────────────────┐  │
        │  │  Event Logging         │  │
        │  │  (Audit Trail)         │  │
        │  └────────────────────────┘  │
        └──────────────────────────────┘
```

### 2.2 Data Flow Patterns

#### 2.2.1 Standard CRUD Flow
```
Client → Supabase Client → PostgREST → RLS Check → PostgreSQL → Response
```

#### 2.2.2 Real-time Subscription Flow
```
Client → Supabase Realtime Subscription → PostgreSQL Triggers → WebSocket → Client
```

#### 2.2.3 Background Job Flow
```
pg_cron → PostgreSQL Function → Edge Function (if needed) → External API → Update DB
```

#### 2.2.4 File Upload Flow
```
Client → Supabase Storage API → Supabase Storage → PostgreSQL (metadata) → Client
```

---

## 3. Module Architecture

### 3.1 Frontend Modules

#### 3.1.1 Core Modules
- **`supabase.js`**: Supabase client initialization
- **`auth.js`**: Authentication logic (login, signup, logout)
- **`ui.js`**: Shared UI utilities (modals, forms, notifications)
- **`loader.js`**: Loading states and skeletons
- **`offline-sync.js`**: Offline data synchronization
- **`notifications.js`**: Notification management (push, in-app)

#### 3.1.2 Feature Modules
- **`dashboard.js`**: Dashboard view and metrics
- **`messages.js`**: In-app messaging system
- **`inventory.js`**: Inventory management
- **`jobs.js`**: Job management
- **`reports.js`**: Reporting and analytics
- **`settings.js`**: User and app settings
- **`user-management.js`**: User and role management

#### 3.1.3 Sales Portal Modules (To Be Implemented)
- **`sales-portal.js`**: Sales portal main view
- **`deal-queue.js`**: Deal queue management
- **`deal-view.js`**: Individual deal view
- **`pipeline.js`**: Pipeline visualization
- **`quotes.js`**: Quote management
- **`call-tracker.js`**: Call tracking and Quo integration
- **`routes.js`**: Route planning and management
- **`sequences.js`**: Follow-up sequence management

#### 3.1.4 Shared Utilities
- **`dark-mode.js`**: Dark mode toggle
- **`custom-dropdown.js`**: Custom dropdown components
- **`photo-capture.js`**: Photo capture and upload
- **`csv-import.js`**: CSV import utilities
- **`pwa.js`**: PWA service worker registration

### 3.2 Backend Modules (Edge Functions)

#### 3.2.1 Email Functions
- **`send-automated-email`**: Send automated emails (sequences, notifications)
- **`send-notification-email`**: Send notification emails
- **`send-invitation-email`**: Send user invitation emails
- **`send-expense-receipt-email`**: Send expense receipt emails
- **`send-purchase-order-email`**: Send purchase order emails

#### 3.2.2 Notification Functions
- **`send-push-notification`**: Send push notifications
- **`send-message-push-notification`**: Send message push notifications

#### 3.2.3 Integration Functions
- **`quickbooks-auth`**: QuickBooks OAuth flow
- **`quickbooks-callback`**: QuickBooks OAuth callback
- **`stripe-connect-oauth`**: Stripe Connect OAuth flow

#### 3.2.4 Subscription Functions
- **`charge-subscription`**: Charge recurring subscriptions
- **`save-subscription`**: Save subscription details
- **`process-recurring-billing`**: Process recurring billing

#### 3.2.5 Sales Functions (To Be Implemented)
- **`quo-call-logger`**: Log calls from Quo integration
- **`quo-call-webhook`**: Webhook handler for Quo events
- **`route-optimizer`**: Optimize door-to-door routes
- **`sequence-executor`**: Execute follow-up sequences

### 3.3 Database Modules (PostgreSQL)

#### 3.3.1 Core Tables
- **`auth.users`**: Supabase auth users (managed by Supabase)
- **`user_profiles`**: Extended user profile information
- **`user_invitations`**: User invitation management
- **`company_profiles`**: Company/organization profiles
- **`platform_subscriptions`**: Subscription management

#### 3.3.2 Sales Domain Tables (To Be Implemented)
- **`leads`**: Lead records
- **`deals`**: Deal/Opportunity records
- **`contacts`**: Contact records
- **`companies`**: Company/Account records
- **`quotes`**: Quote records
- **`quote_templates`**: Quote template definitions
- **`quote_items`**: Quote line items
- **`activities`**: Activity records (calls, emails, meetings, tasks, notes)
- **`calls`**: Call records (linked to activities)
- **`messages`**: Message records (existing)
- **`conversations`**: Conversation records (existing)
- **`routes`**: Route definitions
- **`doors`**: Door/Target records
- **`route_visits`**: Route visit records
- **`tasks`**: Task records
- **`sequences`**: Follow-up sequence definitions
- **`sequence_enrollments`**: Sequence enrollment records
- **`sequence_steps`**: Sequence step definitions

#### 3.3.3 Operational Tables (Existing)
- **`sites`**: Site/location records
- **`jobs`**: Job records
- **`bookings`**: Booking records
- **`inventory_items`**: Inventory item records
- **`inventory_transactions`**: Inventory transaction records
- **`notifications`**: Notification records

#### 3.3.4 Audit & Compliance Tables
- **`audit_logs`**: Comprehensive audit log (see Event Logging Strategy)
- **`consent_records`**: Consent tracking for GDPR/compliance
- **`event_logs`**: Event log for AI/analytics (everything is an event)

---

## 4. Data Flow Patterns

### 4.1 Authentication Flow
```
1. User submits credentials
2. Supabase Auth validates credentials
3. JWT token issued
4. Token stored in client (localStorage/sessionStorage)
5. Token included in all API requests
6. RLS policies enforce access control based on auth.uid()
```

### 4.2 Deal Creation Flow
```
1. User creates deal in UI
2. Client calls supabase.from('deals').insert()
3. PostgREST validates request
4. RLS policy checks user permissions
5. PostgreSQL insert trigger fires (audit log, event log)
6. Deal inserted into database
7. Response returned to client
8. Realtime subscription notifies other clients (if subscribed)
```

### 4.3 Call Logging Flow (Quo Integration)
```
1. Quo webhook sends call data
2. Edge Function (quo-call-webhook) receives webhook
3. Function validates webhook signature
4. Function matches call to contact (phone number lookup)
5. Function creates activity record (type: 'call')
6. Function creates call record (linked to activity)
7. Function creates event log entry
8. Function creates audit log entry
9. Function sends push notification to assigned rep (if needed)
10. Function updates deal stage (if outcome indicates progression)
```

### 4.4 Route Planning Flow
```
1. User selects doors/targets for route
2. Client calls Edge Function (route-optimizer) with door IDs
3. Function queries door locations from database
4. Function calls external route optimization API (Google Maps, etc.)
5. Function receives optimized route
6. Function creates route record in database
7. Function creates route_visits records for each door
8. Response returned to client with route details
9. Client displays route on map
```

### 4.5 Sequence Execution Flow
```
1. pg_cron triggers sequence executor (daily/hourly)
2. Edge Function (sequence-executor) runs
3. Function queries sequence_enrollments for due steps
4. For each due step:
   a. Execute step action (send email, SMS, create task, etc.)
   b. Update sequence_enrollment progress
   c. Log event
   d. Schedule next step (if any)
5. Function updates sequence analytics
```

---

## 5. Security Architecture

### 5.1 Authentication
- **Method**: JWT-based authentication via Supabase Auth
- **Token Storage**: localStorage (web) or secure storage (mobile)
- **Token Refresh**: Automatic refresh via Supabase client
- **Session Management**: Handled by Supabase Auth

### 5.2 Authorization
- **Method**: Row Level Security (RLS) policies
- **Principle**: Least privilege - users only see/modify what they're allowed
- **Policy Types**:
  - SELECT: Who can read data
  - INSERT: Who can create data
  - UPDATE: Who can modify data
  - DELETE: Who can delete data

### 5.3 Data Isolation
- **Multi-tenancy**: Company-based isolation via `company_id` column
- **RLS Enforcement**: All queries filtered by RLS policies
- **Service Role**: Limited use for admin operations only

### 5.4 API Security
- **HTTPS Only**: All API calls over HTTPS
- **CORS**: Configured for allowed origins only
- **Rate Limiting**: Handled by Supabase/Vercel
- **Input Validation**: Client-side and server-side validation

---

## 6. Event Logging Architecture

### 6.1 Event Taxonomy
All events are categorized by:
- **Entity Type**: What was acted upon (deal, contact, call, etc.)
- **Action Type**: What action was taken (create, update, delete, view, etc.)
- **Event Category**: High-level category (sales, marketing, admin, etc.)

See `/docs/EVENT_TAXONOMY.md` for complete taxonomy.

### 6.2 Event Storage
- **Primary Table**: `event_logs` - Structured events for AI/analytics
- **Audit Table**: `audit_logs` - Comprehensive audit trail for compliance
- **Retention**: Configurable per event type
- **Partitioning**: Partitioned by date for performance

### 6.3 Event Flow
```
1. User action occurs (via API or UI)
2. Database trigger fires (for DB changes)
3. Event logged to event_logs table
4. Audit log entry created in audit_logs table
5. Event metadata enriched (user, timestamp, IP, etc.)
6. Event available for analytics/AI processing
```

---

## 7. API Conventions

### 7.1 REST API (via PostgREST)
- **Base URL**: `https://{project}.supabase.co/rest/v1`
- **Authentication**: Bearer token in Authorization header
- **Pagination**: `Range` header (e.g., `Range: 0-9`)
- **Filtering**: Query parameters (e.g., `?status=eq.active`)
- **Ordering**: `order` parameter (e.g., `?order=created_at.desc`)
- **Selecting**: `select` parameter (e.g., `?select=id,name,email`)

### 7.2 Response Format
```json
{
  "data": [...],
  "error": null,
  "count": 100
}
```

### 7.3 Error Handling
```json
{
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": {...}
}
```

### 7.4 ID Format
- **Primary Keys**: UUID (gen_random_uuid())
- **Foreign Keys**: UUID references
- **Legacy IDs**: BIGSERIAL where needed for backward compatibility

### 7.5 Timestamps
- **Format**: ISO 8601 (TIMESTAMPTZ)
- **Columns**: `created_at`, `updated_at`, `deleted_at`
- **Timezone**: UTC stored, converted in client for display

### 7.6 Soft Deletes
- **Method**: `deleted_at` column (TIMESTAMPTZ, nullable)
- **RLS**: Filters out deleted records automatically
- **Recovery**: Set `deleted_at = NULL` to restore

---

## 8. Integration Points

### 8.1 External APIs
- **Quo**: Telephony platform for call tracking
- **Google Maps**: Route optimization and geocoding
- **Twilio**: SMS sending
- **Resend/SendGrid**: Email sending
- **Stripe**: Payment processing
- **QuickBooks**: Accounting integration

### 8.2 Webhook Receivers
- **Quo Webhooks**: Call events, call recordings
- **Stripe Webhooks**: Payment events, subscription updates
- **QuickBooks Webhooks**: Accounting events

### 8.3 Webhook Senders
- **Internal Webhooks**: Triggered by events for cross-module communication
- **External Webhooks**: Send events to external systems (if configured)

---

## 9. Scalability Considerations

### 9.1 Database
- **Indexing**: Comprehensive indexes on frequently queried columns
- **Partitioning**: Large tables partitioned by date
- **Query Optimization**: Use EXPLAIN ANALYZE for slow queries
- **Connection Pooling**: Handled by Supabase/PostgREST

### 9.2 Edge Functions
- **Stateless**: All functions are stateless
- **Cold Starts**: Minimize cold start impact with warm-up strategies
- **Timeouts**: 60-second default timeout, extend for long-running tasks

### 9.3 Storage
- **CDN**: Supabase Storage uses CDN for fast access
- **Image Optimization**: Resize/optimize images on upload
- **File Cleanup**: Periodic cleanup of orphaned files

### 9.4 Caching
- **Client-side**: Cache frequently accessed data in memory
- **CDN**: Static assets cached via CDN
- **Database**: Query result caching (PostgreSQL query cache)

---

## 10. Monitoring & Observability

### 10.1 Logging
- **Edge Functions**: Console.log captured by Supabase
- **Database**: PostgreSQL logs via Supabase dashboard
- **Client**: Browser console + optional error reporting service

### 10.2 Metrics
- **Supabase Dashboard**: Database performance, API usage
- **Custom Metrics**: Track business metrics in database
- **Error Tracking**: Optional integration with error tracking service (Sentry, etc.)

### 10.3 Alerts
- **Database Alerts**: Configured in Supabase dashboard
- **Function Alerts**: Error rate monitoring
- **Business Alerts**: Custom alerts for business-critical events

---

## 11. Development Workflow

### 11.1 Local Development
- **Supabase Local**: Use Supabase CLI for local development
- **Environment Variables**: `.env.local` for local config
- **Database Migrations**: SQL migration files in `/supabase/migrations`

### 11.2 Testing
- **Unit Tests**: JavaScript tests (Vitest/Jest) for frontend logic
- **Integration Tests**: Test API endpoints and database functions
- **E2E Tests**: Test critical user flows (optional)

### 11.3 Deployment
- **Frontend**: Deploy to Vercel (or similar)
- **Backend**: Deploy Edge Functions to Supabase
- **Database**: Run migrations via Supabase dashboard or CLI

---

## 12. Future Considerations

### 12.1 Mobile Apps
- **Native Apps**: Consider React Native or Flutter for native mobile apps
- **Hybrid**: PWA can serve as bridge until native apps are built

### 12.2 AI/ML Integration
- **Event Logs**: Rich event logs enable AI/ML models
- **Recommendations**: Deal scoring, next best action
- **Predictive Analytics**: Forecast revenue, identify churn risk

### 12.3 Microservices Migration
- **Current**: Monolithic Supabase architecture
- **Future**: Consider microservices for specific modules if needed
- **Trade-offs**: Complexity vs. scalability
