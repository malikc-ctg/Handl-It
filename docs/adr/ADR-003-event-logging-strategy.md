# ADR-003: Event Logging Strategy ("Everything is an Event")

## Status
Accepted

## Context
To support AI/ML models and comprehensive analytics, we need to log all significant events in the system. Additionally, for compliance and audit purposes, we need a comprehensive audit trail. We adopt the principle that "everything is an event" - every user action, system action, and state change should be logged.

## Decision
We implement a dual-event logging system:

### 1. Event Logs (`event_logs` table)
- **Purpose**: Structured events for AI/ML and analytics
- **Optimized for**: Querying, aggregation, machine learning
- **Retention**: Configurable per event type (default: 2 years)
- **Format**: Structured JSON with consistent schema

### 2. Audit Logs (`audit_logs` table)
- **Purpose**: Comprehensive audit trail for compliance
- **Optimized for**: Compliance, debugging, forensics
- **Retention**: Configurable per event type (default: 7 years)
- **Format**: Detailed JSON with full context

## Event Taxonomy

### Entity Types
The entity that was acted upon:
- `lead`, `deal`, `contact`, `company`, `quote`, `activity`, `call`, `message`, `route`, `door`, `task`, `sequence`, `user`, `site`, `job`, `booking`, `inventory_item`, etc.

### Action Types
The action that was taken:
- `create`, `update`, `delete`, `view`, `assign`, `unassign`, `stage_change`, `status_change`, `approve`, `reject`, `send`, `receive`, `open`, `click`, `download`, `export`, `import`, `login`, `logout`, `permission_change`, etc.

### Event Categories
High-level category for grouping:
- `sales`, `marketing`, `customer_service`, `admin`, `system`, `integration`, `security`, `compliance`, `analytics`, etc.

## Event Schema

### event_logs Table
```sql
CREATE TABLE event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- e.g., 'deal.created', 'call.completed'
  entity_type TEXT NOT NULL, -- e.g., 'deal', 'call'
  entity_id UUID NOT NULL, -- ID of the entity acted upon
  action_type TEXT NOT NULL, -- e.g., 'create', 'update'
  event_category TEXT NOT NULL, -- e.g., 'sales', 'admin'
  user_id UUID REFERENCES auth.users(id), -- User who triggered event
  company_id UUID REFERENCES company_profiles(id), -- Company context
  metadata JSONB DEFAULT '{}', -- Event-specific data
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_logs_event_type ON event_logs(event_type);
CREATE INDEX idx_event_logs_entity_type ON event_logs(entity_type);
CREATE INDEX idx_event_logs_entity_id ON event_logs(entity_id);
CREATE INDEX idx_event_logs_user_id ON event_logs(user_id);
CREATE INDEX idx_event_logs_company_id ON event_logs(company_id);
CREATE INDEX idx_event_logs_created_at ON event_logs(created_at);
CREATE INDEX idx_event_logs_event_category ON event_logs(event_category);
```

### audit_logs Table
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  company_id UUID REFERENCES company_profiles(id),
  ip_address INET,
  user_agent TEXT,
  request_id UUID, -- For tracing requests
  before_state JSONB, -- State before action (for updates/deletes)
  after_state JSONB, -- State after action (for creates/updates)
  changes JSONB, -- Diff of changes (for updates)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

## Event Naming Convention

### Format
`{entity_type}.{action_type}`

### Examples
- `deal.created`
- `deal.stage_changed`
- `call.completed`
- `quote.sent`
- `contact.assigned`
- `route.optimized`
- `sequence.step_executed`
- `user.login`
- `user.permission_changed`

## Logging Triggers

### Database Triggers
PostgreSQL triggers automatically log events on INSERT/UPDATE/DELETE:

```sql
CREATE OR REPLACE FUNCTION log_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Log to event_logs
  INSERT INTO event_logs (
    event_type,
    entity_type,
    entity_id,
    action_type,
    event_category,
    user_id,
    company_id,
    metadata,
    created_at
  ) VALUES (
    TG_TABLE_NAME || '.' || TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE TG_OP
      WHEN 'INSERT' THEN 'create'
      WHEN 'UPDATE' THEN 'update'
      WHEN 'DELETE' THEN 'delete'
    END,
    'sales', -- Default, can be overridden
    auth.uid(),
    COALESCE(NEW.company_id, OLD.company_id),
    jsonb_build_object(
      'trigger', TG_NAME,
      'table', TG_TABLE_NAME,
      'operation', TG_OP
    ),
    NOW()
  );
  
  -- Log to audit_logs with more detail
  INSERT INTO audit_logs (
    event_type,
    entity_type,
    entity_id,
    action_type,
    user_id,
    company_id,
    before_state,
    after_state,
    changes,
    metadata,
    created_at
  ) VALUES (
    TG_TABLE_NAME || '.' || TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE TG_OP
      WHEN 'INSERT' THEN 'create'
      WHEN 'UPDATE' THEN 'update'
      WHEN 'DELETE' THEN 'delete'
    END,
    auth.uid(),
    COALESCE(NEW.company_id, OLD.company_id),
    to_jsonb(OLD), -- NULL for INSERT
    to_jsonb(NEW), -- NULL for DELETE
    CASE
      WHEN TG_OP = 'UPDATE' THEN (
        SELECT jsonb_object_agg(key, value)
        FROM jsonb_each(to_jsonb(NEW))
        WHERE value IS DISTINCT FROM (to_jsonb(OLD)->>key)
      )
      ELSE NULL
    END,
    jsonb_build_object(
      'trigger', TG_NAME,
      'table', TG_TABLE_NAME,
      'operation', TG_OP
    ),
    NOW()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Application-Level Logging
Edge Functions and client code can log events directly:

```typescript
// Edge Function example
await supabase.from('event_logs').insert({
  event_type: 'call.completed',
  entity_type: 'call',
  entity_id: callId,
  action_type: 'update',
  event_category: 'sales',
  user_id: userId,
  company_id: companyId,
  metadata: {
    duration: 300,
    outcome: 'connected',
    notes: 'Productive call'
  }
});
```

## Privacy & Compliance

### Sensitive Data Masking
- **PII Fields**: Mask sensitive fields in audit logs (email, phone, SSN, etc.)
- **GDPR Compliance**: Support data deletion requests via `deleted_at` on logs
- **Retention Policies**: Automatic cleanup of old logs based on retention policy

### Access Control
- **RLS Policies**: Audit logs only accessible by admins
- **Event Logs**: Accessible by authorized users for analytics
- **Log Exports**: Support export for compliance reporting

## Analytics & AI Use Cases

### Use Cases
1. **User Behavior Analysis**: Track user actions to improve UX
2. **Deal Scoring**: Analyze event patterns to score deals
3. **Next Best Action**: ML models recommend next actions
4. **Churn Prediction**: Analyze activity patterns to predict churn
5. **Performance Analytics**: Track team and individual performance
6. **Sequence Optimization**: Analyze sequence performance to optimize
7. **Route Optimization**: Analyze route outcomes to optimize routes

## Performance Considerations

### Partitioning
Partition large tables by date for better query performance:
```sql
CREATE TABLE event_logs_2024_01 PARTITION OF event_logs
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Indexing
Comprehensive indexes on frequently queried columns (as shown in schema).

### Archival
Move old logs to cold storage (S3, etc.) for long-term retention.

## Rationale
1. **AI/ML Ready**: Structured events enable machine learning models
2. **Compliance**: Comprehensive audit trail for regulatory requirements
3. **Debugging**: Detailed logs help debug issues
4. **Analytics**: Rich data for business intelligence
5. **Future-Proof**: Extensible schema supports new event types

## Consequences

### Positive
- Rich data for AI/ML models
- Comprehensive audit trail
- Better debugging capabilities
- Advanced analytics possible

### Negative
- Storage costs increase over time
- Performance impact from logging
- Schema maintenance overhead

### Mitigations
- Retention policies to limit storage
- Async logging for performance
- Automated partitioning and archival
- Index optimization

## Related ADRs
- ADR-001: Technology Stack Decisions
- ADR-002: API Conventions
- ADR-004: Domain Model Boundaries
