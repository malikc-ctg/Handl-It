# NFG/Handl.it - Engineering Work Plan

## Overview

This document defines the engineering work plan for implementing Sales Portal, Call Tracker (Quo), and Door-to-Door Route Management features. Each module includes owners (agents), dependencies, acceptance criteria, and integration checklists.

---

## Module Overview

### Phase 1: Foundation (Completed)
- ✅ Domain model documentation
- ✅ API conventions
- ✅ Event logging strategy
- ✅ Architecture documentation

### Phase 2: Database Schema
- **Module**: Sales Domain Database Schema
- **Owner**: Agent 02 (Backend Engineer)
- **Dependencies**: ADR-004 (Domain Model Boundaries)
- **Status**: Pending

### Phase 3: Core Sales Objects
- **Module**: Leads, Deals, Contacts, Companies
- **Owner**: Agent 03 (Full-Stack Engineer)
- **Dependencies**: Phase 2
- **Status**: Pending

### Phase 4: Quotes System
- **Module**: Quote Templates, Quote Generation, Quote Versions
- **Owner**: Agent 04 (Full-Stack Engineer)
- **Dependencies**: Phase 3
- **Status**: Pending

### Phase 5: Call Tracker (Quo Integration)
- **Module**: Quo Integration, Call Logging, Call Timeline, Call Outcomes
- **Owner**: Agent 05 (Backend Integration Engineer)
- **Dependencies**: Phase 3, Quo API access
- **Status**: Pending

### Phase 6: Activities & Tasks
- **Module**: Activity Management, Task Management
- **Owner**: Agent 06 (Full-Stack Engineer)
- **Dependencies**: Phase 3
- **Status**: Pending

### Phase 7: Routes & Doors
- **Module**: Route Planning, Door/Target Management, Route Optimization
- **Owner**: Agent 07 (Full-Stack Engineer)
- **Dependencies**: Phase 3, Google Maps API access
- **Status**: Pending

### Phase 8: Sequences
- **Module**: Sequence Builder, Sequence Execution, Sequence Analytics
- **Owner**: Agent 08 (Backend Engineer)
- **Dependencies**: Phase 3, Phase 6
- **Status**: Pending

### Phase 9: Sales Portal UI
- **Module**: Deal Queue, Deal View, Pipeline
- **Owner**: Agent 09 (Frontend Engineer)
- **Dependencies**: Phase 3
- **Status**: Pending

### Phase 10: Permissions & Compliance
- **Module**: RBAC, Consent Flags, Location Gating, Audit Logs
- **Owner**: Agent 10 (Security Engineer)
- **Dependencies**: All phases
- **Status**: Pending

---

## Module Specifications

### Module 1: Sales Domain Database Schema

**Owner**: Agent 02 (Backend Engineer)  
**Dependencies**: ADR-004 (Domain Model Boundaries)  
**Estimate**: 3 days

#### Tasks
1. Create database schema for all sales domain objects
2. Implement RLS policies for all tables
3. Create database triggers for event logging
4. Create indexes for performance
5. Add soft delete support (`deleted_at` columns)
6. Create database functions for common operations
7. Write migration scripts

#### Acceptance Criteria
- [ ] All tables created with proper schema (leads, deals, contacts, companies, quotes, activities, calls, routes, doors, tasks, sequences)
- [ ] RLS policies implemented and tested
- [ ] Database triggers fire on all create/update/delete operations
- [ ] Event logs created for all database changes
- [ ] Audit logs created for all database changes
- [ ] All indexes created for frequently queried columns
- [ ] Soft delete working correctly (RLS filters deleted records)
- [ ] Migration scripts tested and documented

#### Integration Points
- Event logging triggers (ADR-003)
- Audit logging triggers (ADR-003)
- API conventions (ADR-002)

#### Definition of Done
- ✅ All acceptance criteria met
- ✅ Database schema reviewed and approved
- ✅ RLS policies tested with different user roles
- ✅ Event logs verified for all operations
- ✅ Migration scripts tested on staging
- ✅ Documentation updated

---

### Module 2: Core Sales Objects (Leads, Deals, Contacts, Companies)

**Owner**: Agent 03 (Full-Stack Engineer)  
**Dependencies**: Module 1  
**Estimate**: 5 days

#### Tasks
1. Create API endpoints (via Supabase client) for Leads
2. Create API endpoints for Deals
3. Create API endpoints for Contacts
4. Create API endpoints for Companies
5. Implement CRUD operations for all objects
6. Implement filtering, sorting, pagination
7. Implement relationship queries (contact with deals, etc.)
8. Create Edge Functions for complex operations
9. Create frontend modules (leads.js, deals.js, contacts.js, companies.js)
10. Create UI components for listing, viewing, editing
11. Implement real-time subscriptions
12. Add search functionality

#### Acceptance Criteria
- [ ] All CRUD operations working for Leads, Deals, Contacts, Companies
- [ ] Filtering, sorting, pagination working correctly
- [ ] Relationship queries working (contact.deals, deal.contacts, etc.)
- [ ] Real-time subscriptions working (changes propagate to UI)
- [ ] Search working across all objects
- [ ] Edge Functions handling complex operations (bulk operations, etc.)
- [ ] UI components displaying data correctly
- [ ] Forms validating input correctly
- [ ] Error handling working correctly
- [ ] Event logs created for all operations
- [ ] Audit logs created for all operations

#### Integration Points
- Database schema (Module 1)
- Event logging (ADR-003)
- API conventions (ADR-002)
- Authentication (existing)

#### Definition of Done
- ✅ All acceptance criteria met
- ✅ Unit tests written for API functions
- ✅ Integration tests written for API endpoints
- ✅ UI components tested in browser
- ✅ Real-time subscriptions tested
- ✅ Error handling tested
- ✅ Code reviewed and approved
- ✅ Documentation updated

---

### Module 3: Quotes System

**Owner**: Agent 04 (Full-Stack Engineer)  
**Dependencies**: Module 2  
**Estimate**: 6 days

#### Tasks
1. Create database schema for quote_templates, quotes, quote_items
2. Implement quote template management (CRUD)
3. Implement quote generation from templates
4. Implement quote versioning
5. Implement quote PDF generation
6. Implement quote email sending
7. Create Edge Function for PDF generation
8. Create Edge Function for email sending
9. Create frontend module (quotes.js)
10. Create UI for quote templates
11. Create UI for quote generation and editing
12. Create UI for quote version comparison
13. Implement quote status tracking
14. Implement quote approval workflow (if needed)

#### Acceptance Criteria
- [ ] Quote templates can be created, edited, deleted
- [ ] Quotes can be generated from templates
- [ ] Quote versioning working correctly
- [ ] Quote PDF generation working correctly
- [ ] Quote email sending working correctly
- [ ] Quote status tracking working (draft, sent, viewed, accepted, rejected)
- [ ] Quote version comparison UI working
- [ ] Quote approval workflow working (if implemented)
- [ ] Quote line items (products/services) working correctly
- [ ] Pricing calculations working correctly
- [ ] Quote expiration dates working correctly

#### Integration Points
- Core Sales Objects (Module 2)
- Email service (existing Edge Functions)
- PDF generation service (new Edge Function)
- Event logging (ADR-003)

#### Definition of Done
- ✅ All acceptance criteria met
- ✅ PDF generation tested with various templates
- ✅ Email sending tested
- ✅ Quote versioning tested
- ✅ Code reviewed and approved
- ✅ Documentation updated

---

### Module 4: Call Tracker (Quo Integration)

**Owner**: Agent 05 (Backend Integration Engineer)  
**Dependencies**: Module 2, Quo API access  
**Estimate**: 7 days

#### Tasks
1. Research Quo API documentation
2. Set up Quo API credentials
3. Create Edge Function for Quo webhook receiver
4. Implement call logging from Quo webhooks
5. Implement contact matching (phone number lookup)
6. Create database schema for calls (if not in Module 1)
7. Create API endpoints for calls
8. Implement call timeline view
9. Implement call outcome classification
10. Implement call transcript storage (if available)
11. Implement call recording storage (if available)
12. Create Edge Function for call processing
13. Create frontend module (call-tracker.js)
14. Create UI for call timeline
15. Create UI for call details
16. Create UI for call outcomes
17. Implement next action recommendations
18. Implement call analytics

#### Acceptance Criteria
- [ ] Quo webhook receiver working correctly
- [ ] Calls automatically logged when received from Quo
- [ ] Contact matching working (phone number lookup)
- [ ] Call timeline displaying all calls for contact/deal
- [ ] Call outcomes classified correctly
- [ ] Call transcripts stored (if available)
- [ ] Call recordings stored (if available)
- [ ] Next action recommendations working
- [ ] Call analytics displaying correctly
- [ ] Real-time call updates working

#### Integration Points
- Core Sales Objects (Module 2)
- Activities (Module 6)
- Event logging (ADR-003)
- Quo API

#### Definition of Done
- ✅ All acceptance criteria met
- ✅ Quo webhook tested with sample data
- ✅ Contact matching tested with various phone number formats
- ✅ Call timeline tested with multiple calls
- ✅ Code reviewed and approved
- ✅ Documentation updated (including Quo API integration guide)

---

### Module 5: Activities & Tasks

**Owner**: Agent 06 (Full-Stack Engineer)  
**Dependencies**: Module 2  
**Estimate**: 5 days

#### Tasks
1. Create database schema for activities, tasks (if not in Module 1)
2. Implement Activity CRUD operations
3. Implement Task CRUD operations
4. Implement activity scheduling
5. Implement activity reminders
6. Implement activity completion tracking
7. Implement task assignment
8. Implement task prioritization
9. Create Edge Functions for activity reminders
10. Create Edge Function for activity processing
11. Create frontend module (activities.js, tasks.js)
12. Create UI for activity calendar
13. Create UI for activity timeline
14. Create UI for task list
15. Implement activity templates
16. Implement task templates

#### Acceptance Criteria
- [ ] Activities can be created, updated, deleted
- [ ] Activities can be scheduled (with date/time)
- [ ] Activity reminders working (push notifications)
- [ ] Activity completion tracking working
- [ ] Tasks can be created, assigned, completed
- [ ] Task prioritization working
- [ ] Activity calendar displaying correctly
- [ ] Activity timeline displaying correctly
- [ ] Task list displaying correctly
- [ ] Activity templates working
- [ ] Task templates working
- [ ] Activities linked to contacts, deals, routes correctly

#### Integration Points
- Core Sales Objects (Module 2)
- Routes (Module 7)
- Call Tracker (Module 4)
- Event logging (ADR-003)
- Push notifications (existing)

#### Definition of Done
- ✅ All acceptance criteria met
- ✅ Activity reminders tested
- ✅ Task assignment tested
- ✅ Code reviewed and approved
- ✅ Documentation updated

---

### Module 6: Routes & Doors

**Owner**: Agent 07 (Full-Stack Engineer)  
**Dependencies**: Module 2, Google Maps API access  
**Estimate**: 8 days

#### Tasks
1. Create database schema for routes, doors, route_visits (if not in Module 1)
2. Implement Route CRUD operations
3. Implement Door CRUD operations
4. Implement route planning (manual door selection)
5. Implement route optimization (Google Maps API)
6. Implement route sharing
7. Implement route templates
8. Implement door status tracking
9. Implement route visit logging (as Activities)
10. Implement route visit outcomes
11. Create Edge Function for route optimization
12. Create Edge Function for route processing
13. Create frontend module (routes.js, doors.js)
14. Create UI for route planning
15. Create UI for route visualization (map)
16. Create UI for door list
17. Create UI for door details
18. Create UI for route visit logging
19. Implement geocoding (address to coordinates)
20. Implement route analytics

#### Acceptance Criteria
- [ ] Routes can be created, updated, deleted
- [ ] Doors can be created, updated, deleted
- [ ] Route planning working (manual door selection)
- [ ] Route optimization working (Google Maps API)
- [ ] Route sharing working
- [ ] Route templates working
- [ ] Door status tracking working
- [ ] Route visit logging working (creates Activity records)
- [ ] Route visit outcomes working
- [ ] Route visualization on map working
- [ ] Geocoding working (address to coordinates)
- [ ] Route analytics displaying correctly

#### Integration Points
- Core Sales Objects (Module 2)
- Activities (Module 5)
- Google Maps API
- Event logging (ADR-003)

#### Definition of Done
- ✅ All acceptance criteria met
- ✅ Route optimization tested with various door sets
- ✅ Route visit logging tested
- ✅ Map visualization tested
- ✅ Code reviewed and approved
- ✅ Documentation updated (including Google Maps API integration guide)

---

### Module 7: Sequences

**Owner**: Agent 08 (Backend Engineer)  
**Dependencies**: Module 2, Module 5  
**Estimate**: 7 days

#### Tasks
1. Create database schema for sequences, sequence_steps, sequence_enrollments (if not in Module 1)
2. Implement Sequence CRUD operations
3. Implement Sequence Step CRUD operations
4. Implement sequence builder (UI)
5. Implement sequence enrollment
6. Implement sequence step execution
7. Implement sequence automation (pg_cron + Edge Function)
8. Implement sequence exit conditions
9. Implement sequence pause/resume
10. Implement sequence analytics
11. Create Edge Function for sequence execution
12. Create Edge Function for sequence processing
13. Create frontend module (sequences.js)
14. Create UI for sequence builder
15. Create UI for sequence enrollment
16. Create UI for sequence analytics
17. Implement sequence templates

#### Acceptance Criteria
- [ ] Sequences can be created, updated, deleted
- [ ] Sequence steps can be added, reordered, removed
- [ ] Sequence builder UI working (drag-and-drop)
- [ ] Sequence enrollment working
- [ ] Sequence step execution working (sends email, SMS, creates task, etc.)
- [ ] Sequence automation working (runs on schedule)
- [ ] Sequence exit conditions working
- [ ] Sequence pause/resume working
- [ ] Sequence analytics displaying correctly
- [ ] Sequence templates working

#### Integration Points
- Core Sales Objects (Module 2)
- Activities (Module 5)
- Email service (existing Edge Functions)
- SMS service (if implemented)
- Event logging (ADR-003)
- pg_cron (background jobs)

#### Definition of Done
- ✅ All acceptance criteria met
- ✅ Sequence execution tested with various sequences
- ✅ Sequence automation tested
- ✅ Sequence analytics tested
- ✅ Code reviewed and approved
- ✅ Documentation updated

---

### Module 8: Sales Portal UI

**Owner**: Agent 09 (Frontend Engineer)  
**Dependencies**: Module 2  
**Estimate**: 10 days

#### Tasks
1. Create deal queue UI (filtering, sorting, pagination)
2. Create deal view UI (details, timeline, activities)
3. Create pipeline UI (Kanban board)
4. Implement deal stage drag-and-drop
5. Implement deal bulk actions
6. Implement deal quick actions
7. Create lead management UI
8. Create contact management UI
9. Create company management UI
10. Implement search across all objects
11. Implement advanced filtering
12. Implement saved filters
13. Create dashboard widgets
14. Implement real-time updates
15. Create responsive design (mobile-friendly)
16. Implement offline support (if needed)

#### Acceptance Criteria
- [ ] Deal queue displaying correctly with filtering, sorting, pagination
- [ ] Deal view displaying all details, timeline, activities
- [ ] Pipeline displaying deals in stages (Kanban)
- [ ] Deal stage drag-and-drop working
- [ ] Deal bulk actions working
- [ ] Deal quick actions working
- [ ] Lead management UI working
- [ ] Contact management UI working
- [ ] Company management UI working
- [ ] Search working across all objects
- [ ] Advanced filtering working
- [ ] Saved filters working
- [ ] Dashboard widgets displaying correctly
- [ ] Real-time updates working
- [ ] Responsive design working (mobile-friendly)

#### Integration Points
- Core Sales Objects (Module 2)
- Quotes (Module 3)
- Call Tracker (Module 4)
- Activities (Module 5)
- Routes (Module 6)
- Sequences (Module 7)

#### Definition of Done
- ✅ All acceptance criteria met
- ✅ UI tested in different browsers
- ✅ Mobile responsiveness tested
- ✅ Real-time updates tested
- ✅ Code reviewed and approved
- ✅ Documentation updated

---

### Module 9: Permissions & Compliance

**Owner**: Agent 10 (Security Engineer)  
**Dependencies**: All modules  
**Estimate**: 5 days

#### Tasks
1. Review and update RLS policies for all tables
2. Implement RBAC (Role-Based Access Control)
3. Implement consent flags (GDPR compliance)
4. Implement consent tracking
5. Implement location gating (if needed)
6. Implement audit log access control
7. Implement audit log search and filtering
8. Implement audit log export
9. Implement sensitive data masking in logs
10. Create UI for consent management
11. Create UI for audit log viewing
12. Implement log retention policies
13. Test RBAC with different roles
14. Test consent enforcement
15. Test audit log access

#### Acceptance Criteria
- [ ] RLS policies implemented for all tables
- [ ] RBAC working correctly (roles, permissions)
- [ ] Consent flags working (tracking, enforcement)
- [ ] Consent history tracking working
- [ ] Location gating working (if implemented)
- [ ] Audit log access control working (admin only)
- [ ] Audit log search and filtering working
- [ ] Audit log export working
- [ ] Sensitive data masking in logs working
- [ ] Consent management UI working
- [ ] Audit log viewing UI working
- [ ] Log retention policies working

#### Integration Points
- All modules
- Event logging (ADR-003)
- Audit logging (ADR-003)

#### Definition of Done
- ✅ All acceptance criteria met
- ✅ RBAC tested with different roles
- ✅ Consent enforcement tested
- ✅ Audit log access tested
- ✅ Security review completed
- ✅ Code reviewed and approved
- ✅ Documentation updated

---

## Integration Checklist

### Cross-Module Integration Points

#### Event Logging
- [ ] All modules create event logs for CRUD operations
- [ ] Event logs include correct metadata
- [ ] Event logs queryable via API

#### Audit Logging
- [ ] All modules create audit logs for CRUD operations
- [ ] Audit logs include before/after state
- [ ] Audit logs include user, IP, timestamp

#### Authentication
- [ ] All modules use Supabase Auth
- [ ] All API calls include auth token
- [ ] RLS policies enforced on all tables

#### Real-time Updates
- [ ] All modules subscribe to real-time changes
- [ ] UI updates when data changes
- [ ] Real-time subscriptions cleaned up on unmount

#### Error Handling
- [ ] All modules handle errors consistently
- [ ] Error messages user-friendly
- [ ] Errors logged to console/server

#### Loading States
- [ ] All modules show loading states
- [ ] Loading states consistent across UI
- [ ] Loading states cleared on error/success

#### Offline Support
- [ ] All modules handle offline gracefully
- [ ] Offline data cached (if needed)
- [ ] Offline changes synced when online

---

## Definition of Done (Overall)

### Code Quality
- [ ] Code follows project conventions
- [ ] Code reviewed and approved
- [ ] Unit tests written (where applicable)
- [ ] Integration tests written (where applicable)
- [ ] No linter errors
- [ ] No console errors in production

### Documentation
- [ ] API documentation updated
- [ ] User documentation updated (if needed)
- [ ] ADRs updated (if decisions changed)
- [ ] README updated (if needed)

### Testing
- [ ] All acceptance criteria met
- [ ] Manual testing completed
- [ ] Integration testing completed
- [ ] Security testing completed (for security-related modules)
- [ ] Performance testing completed (for performance-critical modules)

### Deployment
- [ ] Code merged to main branch
- [ ] Database migrations tested on staging
- [ ] Edge Functions deployed to staging
- [ ] Frontend deployed to staging
- [ ] Staging testing completed
- [ ] Production deployment completed
- [ ] Production smoke tests completed

---

## Dependencies & Risks

### External Dependencies
- **Quo API**: Requires API access and documentation
- **Google Maps API**: Requires API key and billing setup
- **Email Service**: Requires email service setup (Resend/SendGrid)
- **SMS Service**: Requires SMS service setup (Twilio, if needed)

### Technical Risks
- **Quo API Changes**: Quo API may change, breaking integration
- **Google Maps API Costs**: Route optimization may be expensive at scale
- **Performance**: Real-time updates and large datasets may cause performance issues
- **Complexity**: Sequence execution and route optimization may be complex

### Mitigations
- **Quo API**: Version API integration, handle errors gracefully
- **Google Maps API**: Monitor costs, implement caching, optimize usage
- **Performance**: Implement pagination, indexing, query optimization
- **Complexity**: Break down into smaller tasks, thorough testing

---

## Timeline Estimate

### Phase 1: Foundation (Completed)
- Duration: 3 days
- Status: ✅ Complete

### Phase 2: Database Schema
- Duration: 3 days
- Start: Day 4
- End: Day 6

### Phase 3: Core Sales Objects
- Duration: 5 days
- Start: Day 7
- End: Day 11

### Phase 4: Quotes System
- Duration: 6 days
- Start: Day 12
- End: Day 17

### Phase 5: Call Tracker
- Duration: 7 days
- Start: Day 18 (parallel with Phase 6)
- End: Day 24

### Phase 6: Activities & Tasks
- Duration: 5 days
- Start: Day 18 (parallel with Phase 5)
- End: Day 22

### Phase 7: Routes & Doors
- Duration: 8 days
- Start: Day 25
- End: Day 32

### Phase 8: Sequences
- Duration: 7 days
- Start: Day 33
- End: Day 39

### Phase 9: Sales Portal UI
- Duration: 10 days
- Start: Day 40 (can start earlier in parallel)
- End: Day 49

### Phase 10: Permissions & Compliance
- Duration: 5 days
- Start: Day 50
- End: Day 54

**Total Estimated Duration**: 54 working days (~11 weeks)

**Note**: Some phases can run in parallel to reduce overall duration.

---

## Success Metrics

### Technical Metrics
- **Code Coverage**: >70% for critical modules
- **API Response Time**: <200ms for 95% of requests
- **Page Load Time**: <2 seconds for initial load
- **Error Rate**: <1% of requests

### Business Metrics
- **User Adoption**: Track user engagement with new features
- **Feature Usage**: Track which features are used most
- **Conversion Rates**: Track lead-to-deal conversion rates
- **Route Efficiency**: Track route optimization improvements

---

## Ongoing Maintenance

### Monitoring
- Monitor error rates and performance
- Monitor API usage and costs
- Monitor user feedback and issues

### Updates
- Regular dependency updates
- Security patches
- Feature enhancements based on user feedback

### Documentation
- Keep documentation up to date
- Document new features and changes
- Update ADRs when decisions change
