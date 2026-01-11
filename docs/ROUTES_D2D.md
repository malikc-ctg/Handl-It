# Door-to-Door Route Management System

## Overview

The Door-to-Door Route Management system enables sales representatives to manage and execute door-to-door sales routes from their mobile devices. The system includes territory selection, route creation, door target management, visit tracking, and integration with the sales pipeline.

## Features

### 1. Territory Selection
- **Postal Code Selection**: Select territories by postal codes
- **Polygon Selection**: Define territories using polygon coordinates (GeoJSON)
- **List Import**: Import door targets from CSV or manual list

### 2. Route Management
- Create routes for specific dates
- Assign routes to sales representatives
- Route status tracking (draft, active, completed, cancelled)
- Route session management (explicit start/stop)

### 3. Door Targets
- Address-based door targets with geocoding (lat/lng)
- Property type classification (residential, commercial, apartment, condo, other)
- Tagging system for filtering and organization
- Sequence ordering for route optimization
- Status tracking (pending, visited, skipped, not_available)

### 4. Door Visit Tracking
- Record door visits with outcomes:
  - `knocked`: Door was knocked
  - `no_answer`: No one answered
  - `not_interested`: Contact not interested
  - `follow_up_requested`: Contact requested follow-up
  - `dm_not_present`: Decision maker not present
  - `appointment_set`: Appointment scheduled
- Optional notes for each visit
- Location tracking (lat/lng) when visit occurs

### 5. Cooldown Rules
- Automatic cooldown period (default: 30 days) after door visit
- Doors in cooldown are excluded from "next door" suggestions
- Cooldown period configurable per door target

### 6. Next Door Workflow
- Simple distance-based ordering (v1)
- Shows next best door based on current location
- Quick access to record visit
- Updates in real-time as location changes

### 7. Map View
- Interactive map showing all door targets
- Color-coded pins by status:
  - Blue: Pending
  - Green: Visited
  - Gray: Skipped/Not Available
- Click pins to view door details

### 8. Appointment & Lead Creation
- Automatic lead creation from door visits (when outcome is `follow_up_requested`, `appointment_set`, or `not_interested`)
- Appointment creation from door visits (when outcome is `appointment_set`)
- Follow-up task creation (when outcome is `follow_up_requested`)
- Integration with Sales Portal pipeline

### 9. Manager View
- Route progress metrics:
  - Total doors vs visited
  - Completion percentage
  - Doors knocked per hour
  - Appointments set per hour
- Aggregate metrics across all routes
- Real-time route status monitoring

### 10. Privacy-Safe Location Tracking
- Location tracking only when route is active
- Route-level location points (not door-level)
- Automatic stop when route is completed or cancelled
- Minimal location data stored (coarse points only)

### 11. Offline Mode
- Cache route data locally
- Queue door visits when offline
- Automatic sync when connection restored
- Offline indicator in UI

## Database Schema

### Tables

#### `territories`
- Territory definitions for route planning
- Types: postal_code, polygon, list

#### `routes`
- Route definitions with assigned rep and date
- Status: draft, active, completed, cancelled

#### `door_targets`
- Address-based targets for each route
- Includes location, property type, tags, cooldown info

#### `door_visits`
- Visit events with outcomes and notes
- Links to door_target and route

#### `route_locations`
- Privacy-safe location tracking (route-level only)
- Only recorded when route is active

#### `leads`
- Leads created from door visits
- Links to door_visit and route

#### `appointments`
- Appointments scheduled from door visits
- Links to lead and door_visit

#### `follow_up_tasks`
- Tasks auto-created from door visits
- Links to door_visit and lead

## API Reference

### Routes Module (`js/routes.js`)

#### `createTerritory(territoryData)`
Create a new territory.

**Parameters:**
- `territoryData.name` (string): Territory name
- `territoryData.description` (string, optional): Description
- `territoryData.territory_type` (string): 'postal_code', 'polygon', or 'list'
- `territoryData.postal_codes` (array, optional): Array of postal codes
- `territoryData.polygon_coordinates` (object, optional): GeoJSON polygon

**Returns:** Territory object

#### `createRoute(routeData)`
Create a new route.

**Parameters:**
- `routeData.name` (string): Route name
- `routeData.route_date` (string): Route date (YYYY-MM-DD)
- `routeData.assigned_rep_id` (UUID): Assigned rep user ID
- `routeData.territory_id` (UUID, optional): Territory ID

**Returns:** Route object

#### `startRoute(routeId)`
Start a route session (explicit user action).

**Parameters:**
- `routeId` (UUID): Route ID

**Returns:** Updated route object

#### `recordDoorVisit(visitData)`
Record a door visit with outcome.

**Parameters:**
- `visitData.door_target_id` (UUID): Door target ID
- `visitData.route_id` (UUID): Route ID
- `visitData.outcome` (string): Visit outcome
- `visitData.note` (string, optional): Visit notes
- `visitData.latitude` (number, optional): Visit location lat
- `visitData.longitude` (number, optional): Visit location lng

**Returns:** Door visit object

#### `getNextDoor(routeId, currentLat, currentLng)`
Get next door to visit (distance-based ordering).

**Parameters:**
- `routeId` (UUID): Route ID
- `currentLat` (number, optional): Current latitude
- `currentLng` (number, optional): Current longitude

**Returns:** Door target object or null

#### `getRouteMetrics(routeId)`
Get route metrics for manager view.

**Parameters:**
- `routeId` (UUID): Route ID

**Returns:** Metrics object with:
- `total_doors`: Total door targets
- `visited_doors`: Number of visited doors
- `appointments_set`: Number of appointments set
- `doors_per_hour`: Average doors per hour
- `appointments_per_hour`: Average appointments per hour
- `completion_percentage`: Route completion percentage

### Route Leads Module (`js/route-leads.js`)

#### `createLeadFromVisit(doorVisitId, leadData)`
Create a lead from a door visit.

**Parameters:**
- `doorVisitId` (UUID): Door visit ID
- `leadData` (object): Lead information

**Returns:** Lead object

#### `createAppointmentFromVisit(doorVisitId, appointmentData)`
Create an appointment from a door visit.

**Parameters:**
- `doorVisitId` (UUID): Door visit ID
- `appointmentData` (object): Appointment information

**Returns:** Appointment object

## User Workflows

### Rep Workflow

1. **View Assigned Routes**
   - Navigate to Routes page
   - See all routes assigned to you
   - Filter by status (draft, active, completed)

2. **Start Route Session**
   - Open route detail page
   - Click "Start Route" button
   - Location tracking begins (privacy-safe)
   - "Next Door" card appears

3. **Visit Doors**
   - Use "Next Door" card or door list
   - Click "Visit Now" or "Record Visit"
   - Select outcome from dropdown
   - Add notes if needed
   - If appointment set, fill appointment details
   - Submit visit

4. **Complete Route**
   - Click "Stop Route" when done
   - Location tracking stops
   - Route status changes to completed

### Manager Workflow

1. **Create Route**
   - Navigate to Routes page
   - Click "New Route"
   - Enter route name and date
   - Select assigned rep
   - Optionally select territory
   - Create route

2. **Add Door Targets**
   - Open route detail page
   - Import targets from territory or CSV
   - Or manually add addresses
   - Targets are geocoded automatically

3. **Monitor Progress**
   - View route metrics in real-time
   - See completion percentage
   - Track doors per hour
   - Monitor appointments set

4. **Review Results**
   - View all door visits
   - See created leads and appointments
   - Review follow-up tasks

## Setup Instructions

### 1. Database Setup

Run the SQL schema file in Supabase SQL Editor:

```sql
-- Run: ADD_ROUTE_MANAGEMENT_SCHEMA.sql
```

This creates all necessary tables, indexes, RLS policies, and triggers.

### 2. Verify Tables

Check that all tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'territories', 'routes', 'door_targets', 'door_visits',
  'route_locations', 'leads', 'appointments', 'follow_up_tasks'
);
```

### 3. Test Route Creation

1. Navigate to Routes page
2. Click "New Route"
3. Fill in route details
4. Create route
5. Verify route appears in list

### 4. Test Door Visit

1. Open route detail page
2. Add a door target (manually or import)
3. Start route session
4. Record a door visit
5. Verify visit is recorded and cooldown is set

## Testing

### Unit Tests

#### Cooldown Logic
```javascript
// Test that doors in cooldown are excluded
const targets = await fetchDoorTargets(routeId, { exclude_cooldown: true });
const inCooldown = targets.filter(t => 
  t.cooldown_until && new Date(t.cooldown_until) > new Date()
);
assert(inCooldown.length === 0);
```

#### Distance Ordering
```javascript
// Test that next door is closest
const nextDoor = await getNextDoor(routeId, 40.7128, -74.0060);
const allDoors = await fetchDoorTargets(routeId);
const distances = allDoors.map(d => calculateDistance(40.7128, -74.0060, d.latitude, d.longitude));
const minDistance = Math.min(...distances);
assert(nextDoor.distance === minDistance);
```

### Integration Tests

#### Route Workflow
1. Create route
2. Add door targets
3. Start route session
4. Record door visits
5. Complete route
6. Verify all data is synced

#### Offline Sync
1. Go offline
2. Record door visits
3. Verify visits are queued
4. Go online
5. Verify visits are synced

## Privacy & Security

### Location Tracking
- **Only tracks when route is active**: Location tracking automatically stops when route is completed or cancelled
- **Route-level only**: Location data is stored at route level, not per-door
- **Coarse points**: Only essential location data is stored (lat/lng, timestamp)
- **No background tracking**: Location tracking stops immediately when route stops

### Data Access
- **RLS Policies**: All tables have Row Level Security enabled
- **Rep Access**: Reps can only access routes assigned to them
- **Manager Access**: Managers/admins can access all routes
- **Location Data**: Only assigned rep and managers can view route locations

## Troubleshooting

### Route won't start
- Verify route is in "draft" status
- Verify user is assigned to route
- Check browser console for errors

### Location not tracking
- Verify route is in "active" status
- Check browser geolocation permissions
- Verify HTTPS (required for geolocation)

### Door visits not syncing
- Check offline sync queue
- Verify network connection
- Check browser console for sync errors

### Next door not updating
- Verify location tracking is active
- Check that doors have lat/lng coordinates
- Verify doors are not in cooldown

## Future Enhancements

### v2 Features
- Advanced route optimization (TSP algorithm)
- Multi-day route planning
- Route templates
- Bulk door target import from CSV
- Territory heat maps
- Route analytics dashboard
- Integration with CRM systems
- Voice notes for door visits
- Photo capture for door visits

## Support

For issues or questions:
1. Check this documentation
2. Review browser console for errors
3. Check Supabase logs for database errors
4. Contact development team
