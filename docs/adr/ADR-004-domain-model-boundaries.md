# ADR-004: Domain Model Boundaries

## Status
Accepted

## Context
We need to define clear boundaries for domain objects to ensure consistency, avoid duplication, and enable proper data modeling. The application includes Sales Portal, Call Tracker, and Route Management features, each with overlapping concepts (e.g., contacts appear in sales and routes).

## Decision
We define the following domain model boundaries:

### Core Domain Objects

#### 1. Leads
- **Definition**: Potential customers who have shown interest but haven't been qualified
- **Attributes**: source, score, qualification_status, assigned_to, converted_at
- **Relationships**: 
  - Can convert to Contact or Deal
  - Belongs to Company (optional)
  - Has Activities
- **Lifecycle**: Created → Qualified → Converted (to Contact/Deal) or Lost

#### 2. Deals (Opportunities)
- **Definition**: Sales opportunities with value, stage, and probability
- **Attributes**: title, value, probability, stage, expected_close_date, actual_close_date, status, assigned_to
- **Relationships**:
  - Belongs to Contact (primary contact)
  - Belongs to Company
  - Has Activities
  - Has Quotes
  - Has Tasks
- **Lifecycle**: Prospecting → Qualification → Proposal → Negotiation → Closed (Won/Lost)

#### 3. Contacts
- **Definition**: Individual people who are part of the sales process
- **Attributes**: first_name, last_name, email, phone, role, title, notes
- **Relationships**:
  - Belongs to Company
  - Has Activities (calls, emails, meetings, notes)
  - Has Deals (as primary or secondary contact)
  - Has Messages (in-app)
  - Has Consent records
- **Lifecycle**: Created → Active → Archived

#### 4. Companies (Accounts)
- **Definition**: Organizations that are customers or prospects
- **Attributes**: name, industry, size, website, billing_address, shipping_address, notes
- **Relationships**:
  - Has Contacts (multiple contacts per company)
  - Has Deals
  - Has Quotes
  - Has Sites (for service delivery)
- **Lifecycle**: Created → Active → Archived

#### 5. Quotes
- **Definition**: Price proposals sent to contacts/companies
- **Attributes**: quote_number, status, total_amount, expires_at, accepted_at, rejected_at, version
- **Relationships**:
  - Belongs to Deal (optional)
  - Belongs to Contact
  - Belongs to Company
  - Has Quote Items (line items)
  - Based on Quote Template
- **Lifecycle**: Draft → Sent → Viewed → Accepted/Rejected → Archived

#### 6. Quote Templates
- **Definition**: Reusable templates for generating quotes
- **Attributes**: name, description, template_data, version
- **Relationships**:
  - Has Quotes (instances)
- **Lifecycle**: Created → Active → Deprecated

#### 7. Activities (Events)
- **Definition**: Time-bound events and interactions
- **Types**: `call`, `email`, `meeting`, `task`, `note`
- **Attributes**: type, subject, description, scheduled_at, completed_at, outcome, notes
- **Relationships**:
  - Belongs to Contact (optional)
  - Belongs to Deal (optional)
  - Belongs to Company (optional)
  - Belongs to Route (for route visits)
  - Has Activity Participants
- **Lifecycle**: Scheduled → In Progress → Completed/Cancelled

#### 8. Calls
- **Definition**: Telephone call records (linked to Activities)
- **Attributes**: phone_number, direction (inbound/outbound), duration, recording_url, transcript, outcome, notes
- **Relationships**:
  - Is an Activity (type: 'call')
  - Belongs to Contact (matched by phone number)
  - Linked to Deal (if related)
  - Source: Quo integration (webhook)
- **Lifecycle**: Initiated → In Progress → Completed → Logged

#### 9. Messages
- **Definition**: In-app messages between users (existing)
- **Attributes**: content, message_type, read_at, deleted_at
- **Relationships**:
  - Belongs to Conversation
  - Belongs to User (sender)
  - Has Message Reads
- **Lifecycle**: Created → Sent → Delivered → Read → Archived/Deleted

#### 10. Routes
- **Definition**: Planned door-to-door routes for sales reps
- **Attributes**: name, scheduled_date, start_time, end_time, status, optimized_path
- **Relationships**:
  - Has Doors (targets)
  - Has Route Visits (Activity records)
  - Assigned to User (sales rep)
  - Belongs to Territory
- **Lifecycle**: Planned → Scheduled → In Progress → Completed → Archived

#### 11. Doors (Targets)
- **Definition**: Individual doors/locations to visit in routes
- **Attributes**: address, coordinates (lat/lng), door_type (residential/commercial), status, notes, photos
- **Relationships**:
  - Has Route Visits (Activity records)
  - Belongs to Route
  - Can be linked to Contact (if converted)
  - Can be linked to Deal (if converted)
- **Lifecycle**: Created → Visited → Converted/Lost → Archived

#### 12. Tasks
- **Definition**: Action items assigned to users
- **Attributes**: title, description, due_date, priority, status, completed_at, assigned_to
- **Relationships**:
  - Is an Activity (type: 'task')
  - Belongs to Deal (optional)
  - Belongs to Contact (optional)
  - Belongs to Route (optional)
- **Lifecycle**: Created → Assigned → In Progress → Completed/Cancelled

#### 13. Sequences
- **Definition**: Automated follow-up sequences (email, SMS, calls)
- **Attributes**: name, description, status, trigger_conditions, exit_conditions
- **Relationships**:
  - Has Sequence Steps
  - Has Sequence Enrollments
- **Lifecycle**: Created → Active → Paused → Archived

#### 14. Sequence Enrollments
- **Definition**: Contacts/Deals enrolled in sequences
- **Attributes**: status, current_step, started_at, completed_at, exited_at, exit_reason
- **Relationships**:
  - Belongs to Sequence
  - Belongs to Contact or Deal
- **Lifecycle**: Enrolled → Active → Completed/Exited → Archived

#### 15. Sequence Steps
- **Definition**: Individual steps in a sequence
- **Attributes**: step_number, action_type (email/sms/call/task), delay_days, template_id, conditional_logic
- **Relationships**:
  - Belongs to Sequence
  - Executed as Sequence Enrollments progress
- **Lifecycle**: Created → Active → Deprecated

### Cross-Domain Relationships

#### Activities as Universal Link
Activities serve as the universal link between different domains:
- **Sales**: Calls, emails, meetings related to deals
- **Routes**: Route visits are Activities (type: 'route_visit')
- **Sequences**: Sequence steps execute as Activities

#### Contact as Central Entity
Contacts are central to both sales and routes:
- **Sales**: Primary entity in sales process
- **Routes**: Doors can convert to Contacts when interested

#### Company as Context
Companies provide context for:
- **Sales**: Multiple contacts per company, company-level deals
- **Service**: Sites belong to companies (existing)

### Data Integrity Rules

1. **Deals must have Contact or Company**: At least one required
2. **Quotes must have Contact or Company**: At least one required
3. **Activities must have Contact, Deal, Company, or Route**: At least one required
4. **Calls are Activities**: All calls create an Activity record (type: 'call')
5. **Route Visits are Activities**: All route visits create an Activity record (type: 'route_visit')
6. **Sequence Steps create Activities**: When executed, create Activity records
7. **Tasks are Activities**: All tasks are Activity records (type: 'task')

### Naming Conventions

#### Tables
- Plural nouns: `deals`, `contacts`, `companies`, `quotes`, `activities`, `calls`, `routes`, `doors`, `tasks`, `sequences`

#### Columns
- Snake case: `created_at`, `updated_at`, `assigned_to`, `expected_close_date`
- Foreign keys: `{entity}_id` (e.g., `contact_id`, `deal_id`)
- Status fields: `status` (with CHECK constraints for allowed values)
- Timestamps: `{action}_at` (e.g., `created_at`, `completed_at`, `accepted_at`)

#### Relationships
- Many-to-One: `{entity}_id` (e.g., `deal_id`, `contact_id`)
- One-to-Many: Foreign key on related table
- Many-to-Many: Junction table (e.g., `deal_contacts`, `route_doors`)

## Rationale
1. **Clear Boundaries**: Each domain object has a clear purpose and lifecycle
2. **Avoid Duplication**: Activities serve as universal link, avoiding duplicate concepts
3. **Flexibility**: Activities can link to multiple domains (sales, routes, sequences)
4. **Consistency**: Standard naming conventions and relationship patterns
5. **Extensibility**: Easy to add new domain objects following the same patterns

## Consequences

### Positive
- Clear data model boundaries
- Consistent relationship patterns
- Flexible linking via Activities
- Easy to extend with new entities

### Negative
- Some complexity in Activity relationships
- Need to ensure data integrity across domains

### Mitigations
- Database constraints for data integrity
- Clear documentation of relationships
- Helper functions for common queries

## Examples

### Creating a Deal
```sql
INSERT INTO deals (
  title, value, stage, probability, expected_close_date,
  contact_id, company_id, assigned_to, created_by
) VALUES (
  'New Service Contract', 50000, 'proposal', 0.7, '2024-06-30',
  'contact-uuid', 'company-uuid', 'user-uuid', 'user-uuid'
);
```

### Creating a Call Activity
```sql
-- Create Activity
INSERT INTO activities (
  type, subject, scheduled_at, completed_at, outcome,
  contact_id, deal_id, created_by
) VALUES (
  'call', 'Follow-up call', NOW(), NOW(), 'connected',
  'contact-uuid', 'deal-uuid', 'user-uuid'
) RETURNING id;

-- Create Call record
INSERT INTO calls (
  activity_id, phone_number, direction, duration, outcome, notes
) VALUES (
  'activity-uuid', '+1234567890', 'outbound', 300, 'connected', 'Productive call'
);
```

### Creating a Route Visit Activity
```sql
-- Create Activity
INSERT INTO activities (
  type, subject, scheduled_at, completed_at, outcome,
  route_id, door_id, created_by
) VALUES (
  'route_visit', 'Door visit', NOW(), NOW(), 'interested',
  'route-uuid', 'door-uuid', 'user-uuid'
) RETURNING id;
```

## Related ADRs
- ADR-001: Technology Stack Decisions
- ADR-002: API Conventions
- ADR-003: Event Logging Strategy
