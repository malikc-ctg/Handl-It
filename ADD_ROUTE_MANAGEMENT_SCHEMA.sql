-- ============================================
-- DOOR-TO-DOOR ROUTE MANAGEMENT SCHEMA
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Territories table (for territory selection)
-- Table may already exist from CORE_SALES_CRM_SCHEMA.sql
CREATE TABLE IF NOT EXISTS territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  territory_type TEXT NOT NULL CHECK (territory_type IN ('postal_code', 'polygon', 'list')),
  postal_codes TEXT[], -- Array of postal codes
  polygon_coordinates JSONB, -- GeoJSON polygon coordinates
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist (handle schema mismatch)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'territories') THEN
    -- Add created_by if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'territories' AND column_name = 'created_by') THEN
      ALTER TABLE territories ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    
    -- Add territory_type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'territories' AND column_name = 'territory_type') THEN
      ALTER TABLE territories ADD COLUMN territory_type TEXT;
    END IF;
    
    -- Add postal_codes if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'territories' AND column_name = 'postal_codes') THEN
      ALTER TABLE territories ADD COLUMN postal_codes TEXT[];
    END IF;
    
    -- Add polygon_coordinates if it doesn't exist (may be named geojson in other schema)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'territories' AND column_name = 'polygon_coordinates') THEN
      ALTER TABLE territories ADD COLUMN polygon_coordinates JSONB;
      -- If geojson exists, copy data
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'territories' AND column_name = 'geojson') THEN
        UPDATE territories SET polygon_coordinates = geojson WHERE polygon_coordinates IS NULL;
      END IF;
    END IF;
  END IF;
END $$;

-- Routes table (route for a day with assigned rep)
-- Table may already exist from CORE_SALES_CRM_SCHEMA.sql
-- Ensure we have the columns we need
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  route_date DATE NOT NULL,
  assigned_rep_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  territory_id UUID REFERENCES territories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'planned', 'in_progress', 'active', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ, -- When route session was started
  completed_at TIMESTAMPTZ, -- When route was completed
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist (handle schema mismatch: assigned_rep_id vs assigned_user_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'routes') THEN
    -- Add assigned_rep_id if it doesn't exist (may be named assigned_user_id in other schema)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'assigned_rep_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'assigned_user_id') THEN
        -- Copy assigned_user_id to assigned_rep_id for compatibility
        ALTER TABLE routes ADD COLUMN assigned_rep_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        UPDATE routes SET assigned_rep_id = assigned_user_id WHERE assigned_user_id IS NOT NULL;
      ELSE
        ALTER TABLE routes ADD COLUMN assigned_rep_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
      END IF;
    END IF;
    
    -- Add route_date if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'route_date') THEN
      ALTER TABLE routes ADD COLUMN route_date DATE;
    END IF;
    
    -- Add started_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'started_at') THEN
      ALTER TABLE routes ADD COLUMN started_at TIMESTAMPTZ;
    END IF;
    
    -- Add completed_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'completed_at') THEN
      ALTER TABLE routes ADD COLUMN completed_at TIMESTAMPTZ;
    END IF;
    
    -- Add created_by if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'created_by') THEN
      ALTER TABLE routes ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Door targets table (addresses to visit)
CREATE TABLE IF NOT EXISTS door_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  address_line_2 TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  property_type TEXT CHECK (property_type IN ('residential', 'commercial', 'apartment', 'condo', 'other')),
  tags TEXT[], -- Array of tags for filtering
  sequence_order INTEGER DEFAULT 0, -- Order in route
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'visited', 'skipped', 'not_available')),
  cooldown_until TIMESTAMPTZ, -- When this door can be visited again
  last_visited_at TIMESTAMPTZ, -- Last visit timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Door visits table (visit events with outcomes)
-- Table may already exist from CORE_SALES_CRM_SCHEMA.sql
CREATE TABLE IF NOT EXISTS door_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  door_target_id UUID REFERENCES door_targets(id) ON DELETE CASCADE,
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
  visited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcome TEXT NOT NULL CHECK (outcome IN (
    'knocked',
    'no_answer',
    'not_interested',
    'follow_up_requested',
    'dm_not_present',
    'appointment_set'
  )),
  note TEXT,
  latitude DECIMAL(10, 8), -- Location when visit occurred
  longitude DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure door_target_id column exists (may be named door_id in other schema)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'door_visits') THEN
    -- Add door_target_id if it doesn't exist (may be named door_id in CORE_SALES_CRM_SCHEMA.sql)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'door_visits' AND column_name = 'door_target_id') THEN
      -- Check if door_targets table exists, if so add the column with foreign key
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'door_targets') THEN
        ALTER TABLE door_visits ADD COLUMN door_target_id UUID REFERENCES door_targets(id) ON DELETE CASCADE;
        -- If door_id exists, try to copy data (but this might not work if tables are different)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'door_visits' AND column_name = 'door_id') THEN
          -- Note: door_id references doors table, door_target_id references door_targets table
          -- They're different tables, so we can't copy directly. Just add the column.
        END IF;
      ELSE
        -- door_targets doesn't exist yet, add column without foreign key constraint
        ALTER TABLE door_visits ADD COLUMN door_target_id UUID;
      END IF;
    END IF;
    
    -- Add visited_by if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'door_visits' AND column_name = 'visited_by') THEN
      ALTER TABLE door_visits ADD COLUMN visited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    
    -- Add visited_at if it doesn't exist (may be named visit_timestamp in other schema)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'door_visits' AND column_name = 'visited_at') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'door_visits' AND column_name = 'visit_timestamp') THEN
        ALTER TABLE door_visits ADD COLUMN visited_at TIMESTAMPTZ;
        UPDATE door_visits SET visited_at = visit_timestamp WHERE visited_at IS NULL;
      ELSE
        ALTER TABLE door_visits ADD COLUMN visited_at TIMESTAMPTZ DEFAULT NOW();
      END IF;
    END IF;
  END IF;
END $$;

-- Route location tracking (privacy-safe, route-level only)
CREATE TABLE IF NOT EXISTS route_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accuracy DECIMAL, -- GPS accuracy in meters
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads table (created from door visits)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  door_visit_id UUID REFERENCES door_visits(id) ON DELETE SET NULL,
  route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
  door_target_id UUID REFERENCES door_targets(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT NOT NULL,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  property_type TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  source TEXT DEFAULT 'door_to_door',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist in leads table (if it already exists from CORE_SALES_CRM_SCHEMA.sql)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads') THEN
    -- Add door_visit_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'door_visit_id') THEN
      -- Check if door_visits table exists before adding foreign key
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'door_visits') THEN
        ALTER TABLE leads ADD COLUMN door_visit_id UUID REFERENCES door_visits(id) ON DELETE SET NULL;
      ELSE
        ALTER TABLE leads ADD COLUMN door_visit_id UUID;
      END IF;
    END IF;
    
    -- Add route_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'route_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'routes') THEN
        ALTER TABLE leads ADD COLUMN route_id UUID REFERENCES routes(id) ON DELETE SET NULL;
      ELSE
        ALTER TABLE leads ADD COLUMN route_id UUID;
      END IF;
    END IF;
    
    -- Add door_target_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'door_target_id') THEN
      -- Check if door_targets table exists before adding foreign key
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'door_targets') THEN
        ALTER TABLE leads ADD COLUMN door_target_id UUID REFERENCES door_targets(id) ON DELETE SET NULL;
      ELSE
        ALTER TABLE leads ADD COLUMN door_target_id UUID;
      END IF;
    END IF;
    
    -- Add created_by if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'created_by') THEN
      ALTER TABLE leads ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Appointments table (created from door visits)
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  door_visit_id UUID REFERENCES door_visits(id) ON DELETE SET NULL,
  route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  duration_minutes INTEGER DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  location_type TEXT DEFAULT 'on_site' CHECK (location_type IN ('on_site', 'phone', 'video', 'other')),
  address TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Follow-up tasks (auto-created from door visits)
CREATE TABLE IF NOT EXISTS follow_up_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  door_visit_id UUID REFERENCES door_visits(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
-- Index for assigned_rep_id (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'assigned_rep_id') THEN
    CREATE INDEX IF NOT EXISTS idx_routes_assigned_rep ON routes(assigned_rep_id);
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'assigned_user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_routes_assigned_user_id ON routes(assigned_user_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_routes_route_date ON routes(route_date);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_door_targets_route_id ON door_targets(route_id);
CREATE INDEX IF NOT EXISTS idx_door_targets_status ON door_targets(status);
CREATE INDEX IF NOT EXISTS idx_door_targets_cooldown ON door_targets(cooldown_until);
CREATE INDEX IF NOT EXISTS idx_door_targets_location ON door_targets(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_door_visits_route_id ON door_visits(route_id);
-- Index for door_target_id (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'door_visits' AND column_name = 'door_target_id') THEN
    CREATE INDEX IF NOT EXISTS idx_door_visits_door_target_id ON door_visits(door_target_id);
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'door_visits' AND column_name = 'door_id') THEN
    CREATE INDEX IF NOT EXISTS idx_door_visits_door_id ON door_visits(door_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_door_visits_visited_at ON door_visits(visited_at);
CREATE INDEX IF NOT EXISTS idx_route_locations_route_id ON route_locations(route_id);
CREATE INDEX IF NOT EXISTS idx_route_locations_recorded_at ON route_locations(recorded_at);
-- Index for door_visit_id in leads (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'door_visit_id') THEN
    CREATE INDEX IF NOT EXISTS idx_leads_door_visit_id ON leads(door_visit_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_appointments_lead_id ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_date ON appointments(scheduled_date);
-- Index for door_visit_id in follow_up_tasks (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follow_up_tasks' AND column_name = 'door_visit_id') THEN
    CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_door_visit_id ON follow_up_tasks(door_visit_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_assigned_to ON follow_up_tasks(assigned_to);

-- Enable Row Level Security
ALTER TABLE territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE door_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE door_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated users to access their own routes and assigned routes
-- Territories: Users can view all, but only create/edit their own
CREATE POLICY "Users can view all territories" ON territories
  FOR SELECT USING (auth.role() = 'authenticated');

-- Create territories policies conditionally based on column existence
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can create territories" ON territories;
  DROP POLICY IF EXISTS "Users can update own territories" ON territories;
  
  -- Create policies based on whether created_by column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'territories' AND column_name = 'created_by') THEN
    -- Column exists: use normal policy
    EXECUTE 'CREATE POLICY "Users can create territories" ON territories
      FOR INSERT WITH CHECK (auth.role() = ''authenticated'' AND (created_by IS NULL OR auth.uid() = created_by))';
    
    EXECUTE 'CREATE POLICY "Users can update own territories" ON territories
      FOR UPDATE USING (auth.role() = ''authenticated'' AND (created_by IS NULL OR auth.uid() = created_by))';
  ELSE
    -- Column doesn't exist: allow all authenticated users
    EXECUTE 'CREATE POLICY "Users can create territories" ON territories
      FOR INSERT WITH CHECK (auth.role() = ''authenticated'')';
    
    EXECUTE 'CREATE POLICY "Users can update own territories" ON territories
      FOR UPDATE USING (auth.role() = ''authenticated'')';
  END IF;
END $$;

-- Routes: Users can view routes they created or are assigned to
CREATE POLICY "Users can view assigned routes" ON routes
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      COALESCE(assigned_rep_id, assigned_user_id) = auth.uid() OR
      auth.uid() = created_by OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'manager')
      )
    )
  );

CREATE POLICY "Users can create routes" ON routes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = created_by);

CREATE POLICY "Assigned reps can update routes" ON routes
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      COALESCE(assigned_rep_id, assigned_user_id) = auth.uid() OR
      auth.uid() = created_by OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'manager')
      )
    )
  );

-- Door targets: Accessible to users who can access the route
CREATE POLICY "Users can view door targets for accessible routes" ON door_targets
  FOR SELECT USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = door_targets.route_id
      AND (
        COALESCE(routes.assigned_rep_id, routes.assigned_user_id) = auth.uid() OR
        routes.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'manager')
        )
      )
    )
  );

CREATE POLICY "Users can create door targets for accessible routes" ON door_targets
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = door_targets.route_id
      AND (
        routes.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'manager')
        )
      )
    )
  );

CREATE POLICY "Users can update door targets for accessible routes" ON door_targets
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = door_targets.route_id
      AND (
        COALESCE(routes.assigned_rep_id, routes.assigned_user_id) = auth.uid() OR
        routes.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'manager')
        )
      )
    )
  );

-- Door visits: Accessible to users who can access the route
CREATE POLICY "Users can view door visits for accessible routes" ON door_visits
  FOR SELECT USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = door_visits.route_id
      AND (
        COALESCE(routes.assigned_rep_id, routes.assigned_user_id) = auth.uid() OR
        routes.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'manager')
        )
      )
    )
  );

CREATE POLICY "Assigned reps can create door visits" ON door_visits
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = door_visits.route_id
      AND COALESCE(routes.assigned_rep_id, routes.assigned_user_id) = auth.uid()
      AND routes.status IN ('in_progress', 'planned')
    )
  );

-- Route locations: Only accessible to assigned rep and managers
CREATE POLICY "Users can view route locations for accessible routes" ON route_locations
  FOR SELECT USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = route_locations.route_id
      AND (
        COALESCE(routes.assigned_rep_id, routes.assigned_user_id) = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'manager')
        )
      )
    )
  );

CREATE POLICY "Assigned reps can create route locations" ON route_locations
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM routes
      WHERE routes.id = route_locations.route_id
      AND COALESCE(routes.assigned_rep_id, routes.assigned_user_id) = auth.uid()
      AND routes.status IN ('in_progress', 'planned')
    )
  );

-- Leads: Users can view leads they created or from their routes
-- Create policies conditionally based on column existence
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view accessible leads" ON leads;
  DROP POLICY IF EXISTS "Users can create leads" ON leads;
  DROP POLICY IF EXISTS "Users can update accessible leads" ON leads;
  
  -- Create policies based on whether created_by column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'created_by') THEN
    -- Column exists: use normal policies
    EXECUTE 'CREATE POLICY "Users can view accessible leads" ON leads
      FOR SELECT USING (
        auth.role() = ''authenticated'' AND (
          auth.uid() = created_by OR
          EXISTS (
            SELECT 1 FROM routes
            WHERE routes.id = leads.route_id
            AND (
              COALESCE(routes.assigned_rep_id, routes.assigned_user_id) = auth.uid() OR
              routes.created_by = auth.uid() OR
              EXISTS (
                SELECT 1 FROM user_profiles
                WHERE user_profiles.id = auth.uid()
                AND user_profiles.role IN (''admin'', ''manager'')
              )
            )
          )
        )
      )';
    
    EXECUTE 'CREATE POLICY "Users can create leads" ON leads
      FOR INSERT WITH CHECK (auth.role() = ''authenticated'' AND (created_by IS NULL OR auth.uid() = created_by))';
    
    EXECUTE 'CREATE POLICY "Users can update accessible leads" ON leads
      FOR UPDATE USING (
        auth.role() = ''authenticated'' AND (
          auth.uid() = created_by OR
          EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN (''admin'', ''manager'')
          )
        )
      )';
  ELSE
    -- Column doesn't exist: allow access based on route_id only
    EXECUTE 'CREATE POLICY "Users can view accessible leads" ON leads
      FOR SELECT USING (
        auth.role() = ''authenticated'' AND (
          EXISTS (
            SELECT 1 FROM routes
            WHERE routes.id = leads.route_id
            AND (
              COALESCE(routes.assigned_rep_id, routes.assigned_user_id) = auth.uid() OR
              routes.created_by = auth.uid() OR
              EXISTS (
                SELECT 1 FROM user_profiles
                WHERE user_profiles.id = auth.uid()
                AND user_profiles.role IN (''admin'', ''manager'')
              )
            )
          )
          OR EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN (''admin'', ''manager'')
          )
        )
      )';
    
    EXECUTE 'CREATE POLICY "Users can create leads" ON leads
      FOR INSERT WITH CHECK (auth.role() = ''authenticated'')';
    
    EXECUTE 'CREATE POLICY "Users can update accessible leads" ON leads
      FOR UPDATE USING (
        auth.role() = ''authenticated'' AND (
          EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN (''admin'', ''manager'')
          )
        )
      )';
  END IF;
END $$;

-- Appointments: Similar to leads
CREATE POLICY "Users can view accessible appointments" ON appointments
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      auth.uid() = created_by OR
      EXISTS (
        SELECT 1 FROM routes
        WHERE routes.id = appointments.route_id
        AND (
          COALESCE(routes.assigned_rep_id, routes.assigned_user_id) = auth.uid() OR
          routes.created_by = auth.uid() OR
          EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('admin', 'manager')
          )
        )
      )
    )
  );

CREATE POLICY "Users can create appointments" ON appointments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = created_by);

CREATE POLICY "Users can update accessible appointments" ON appointments
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      auth.uid() = created_by OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'manager')
      )
    )
  );

-- Follow-up tasks: Users can view tasks assigned to them or from their routes
CREATE POLICY "Users can view accessible follow-up tasks" ON follow_up_tasks
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      auth.uid() = assigned_to OR
      auth.uid() = created_by OR
      EXISTS (
        SELECT 1 FROM routes
        WHERE routes.id = follow_up_tasks.route_id
        AND (
          COALESCE(routes.assigned_rep_id, routes.assigned_user_id) = auth.uid() OR
          routes.created_by = auth.uid() OR
          EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('admin', 'manager')
          )
        )
      )
    )
  );

CREATE POLICY "Users can create follow-up tasks" ON follow_up_tasks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = created_by);

CREATE POLICY "Users can update assigned follow-up tasks" ON follow_up_tasks
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      auth.uid() = assigned_to OR
      auth.uid() = created_by OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'manager')
      )
    )
  );

-- Function to update door target cooldown after visit
CREATE OR REPLACE FUNCTION update_door_cooldown()
RETURNS TRIGGER AS $$
DECLARE
  cooldown_days INTEGER := 30; -- Default 30 days cooldown
  target_id_val UUID;
BEGIN
  target_id_val := COALESCE(NEW.door_target_id, NEW.door_id);
  
  IF target_id_val IS NOT NULL THEN
    -- Try to update door_targets first
    BEGIN
      UPDATE door_targets
      SET 
        cooldown_until = NOW() + (cooldown_days || ' days')::interval,
        last_visited_at = COALESCE(NEW.visited_at, NEW.visit_timestamp, NOW()),
        status = CASE
          WHEN NEW.outcome = 'appointment_set' THEN 'visited'
          WHEN NEW.outcome = 'follow_up_requested' THEN 'visited'
          WHEN NEW.outcome = 'not_interested' THEN 'visited'
          WHEN NEW.outcome = 'no_answer' THEN 'visited'
          WHEN NEW.outcome = 'knocked' THEN 'visited'
          WHEN NEW.outcome = 'dm_not_present' THEN 'visited'
          ELSE 'visited'
        END
      WHERE id = target_id_val;
      
      -- If no rows updated, try doors table
      IF NOT FOUND THEN
        BEGIN
          UPDATE doors
          SET 
            cooldown_until = NOW() + (cooldown_days || ' days')::interval,
            last_visit_at = COALESCE(NEW.visited_at, NEW.visit_timestamp, NOW())
          WHERE id = target_id_val;
        EXCEPTION WHEN OTHERS THEN
          -- Table or columns may not exist, ignore
        END;
      END IF;
    EXCEPTION WHEN undefined_table THEN
      -- door_targets table doesn't exist, try doors
      BEGIN
        UPDATE doors
        SET 
          cooldown_until = NOW() + (cooldown_days || ' days')::interval,
          last_visit_at = COALESCE(NEW.visited_at, NEW.visit_timestamp, NOW())
        WHERE id = target_id_val;
      EXCEPTION WHEN OTHERS THEN
        -- Ignore if table/columns don't exist
      END;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update cooldown when door visit is created
CREATE TRIGGER trigger_update_door_cooldown
  AFTER INSERT ON door_visits
  FOR EACH ROW
  EXECUTE FUNCTION update_door_cooldown();

-- Function to auto-create lead from door visit (when outcome is follow_up_requested or appointment_set)
CREATE OR REPLACE FUNCTION create_lead_from_visit()
RETURNS TRIGGER AS $$
DECLARE
  target_id_val UUID;
  address_val TEXT;
  city_val TEXT;
  state_province_val TEXT;
  postal_code_val TEXT;
  country_val TEXT;
  property_type_val TEXT;
  sql_query TEXT;
BEGIN
  -- Only create lead for specific outcomes
  IF NEW.outcome IN ('follow_up_requested', 'appointment_set', 'not_interested') THEN
    target_id_val := COALESCE(NEW.door_target_id, NEW.door_id);
    
    IF target_id_val IS NOT NULL THEN
      -- Try door_targets first, then doors
      BEGIN
        -- Try to get data from door_targets table
        SELECT dt.address, dt.city, dt.state_province, dt.postal_code, dt.country, dt.property_type::TEXT
        INTO address_val, city_val, state_province_val, postal_code_val, country_val, property_type_val
        FROM door_targets dt
        WHERE dt.id = target_id_val;
        
        -- If no result, try doors table
        IF address_val IS NULL THEN
          BEGIN
            SELECT d.address, NULL, NULL, NULL, NULL, d.property_type::TEXT
            INTO address_val, city_val, state_province_val, postal_code_val, country_val, property_type_val
            FROM doors d
            WHERE d.id = target_id_val;
          EXCEPTION WHEN OTHERS THEN
            -- Tables may not exist, continue with NULLs
          END;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Tables may not exist, use NULLs
      END;
      
      -- Insert lead if we have an address
      IF address_val IS NOT NULL THEN
        -- Use dynamic SQL to handle potentially missing columns
        BEGIN
          -- Check which columns exist and build INSERT accordingly
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'door_visit_id') THEN
            -- Full INSERT with door_visit_id
            EXECUTE format('
              INSERT INTO leads (
                door_visit_id, route_id, door_target_id, address, city, state_province,
                postal_code, country, property_type, source, notes, created_by
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ') USING 
              NEW.id, NEW.route_id, target_id_val, address_val, city_val, 
              state_province_val, postal_code_val, COALESCE(country_val, 'US'),
              property_type_val, 'door_to_door', NEW.note, NEW.visited_by;
          ELSE
            -- INSERT without door-specific columns
            EXECUTE format('
              INSERT INTO leads (address, source, notes, created_at)
              VALUES ($1, $2, $3, NOW())
            ') USING address_val, 'door_to_door', NEW.note;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          -- If INSERT fails, just skip creating the lead
          NULL;
        END;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create lead from door visit
CREATE TRIGGER trigger_create_lead_from_visit
  AFTER INSERT ON door_visits
  FOR EACH ROW
  EXECUTE FUNCTION create_lead_from_visit();

-- Function to auto-create follow-up task (when outcome is follow_up_requested)
CREATE OR REPLACE FUNCTION create_follow_up_task()
RETURNS TRIGGER AS $$
DECLARE
  new_lead_id UUID;
BEGIN
  -- Only create task for follow_up_requested outcome
  IF NEW.outcome = 'follow_up_requested' THEN
    -- Get the lead ID that was just created
    -- Use dynamic SQL to handle potentially missing door_visit_id column
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'door_visit_id') THEN
        EXECUTE format('SELECT id FROM leads WHERE door_visit_id = $1 LIMIT 1')
          USING NEW.id INTO new_lead_id;
      ELSE
        -- If door_visit_id doesn't exist, try to find lead by route_id or other criteria
        BEGIN
          EXECUTE format('SELECT id FROM leads WHERE route_id = $1 ORDER BY created_at DESC LIMIT 1')
            USING NEW.route_id INTO new_lead_id;
        EXCEPTION WHEN OTHERS THEN
          new_lead_id := NULL;
        END;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      new_lead_id := NULL;
    END;
    
    -- Create follow-up task (use dynamic SQL to handle potentially missing columns)
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follow_up_tasks' AND column_name = 'door_visit_id') THEN
        EXECUTE format('
          INSERT INTO follow_up_tasks (
            door_visit_id, lead_id, route_id, assigned_to, title, description, due_date, priority, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ') USING 
          NEW.id, new_lead_id, NEW.route_id, NEW.visited_by,
          'Follow up with door visit contact',
          COALESCE(NEW.note, 'Follow up requested during door-to-door visit'),
          (NOW() + INTERVAL '7 days')::date, 'medium', NEW.visited_by;
      ELSE
        -- If door_visit_id column doesn't exist, insert without it
        EXECUTE format('
          INSERT INTO follow_up_tasks (
            lead_id, route_id, assigned_to, title, description, due_date, priority, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ') USING 
          new_lead_id, NEW.route_id, NEW.visited_by,
          'Follow up with door visit contact',
          COALESCE(NEW.note, 'Follow up requested during door-to-door visit'),
          (NOW() + INTERVAL '7 days')::date, 'medium', NEW.visited_by;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- If INSERT fails, skip creating the task
      NULL;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create follow-up task
CREATE TRIGGER trigger_create_follow_up_task
  AFTER INSERT ON door_visits
  FOR EACH ROW
  EXECUTE FUNCTION create_follow_up_task();

-- Function to update route updated_at timestamp
CREATE OR REPLACE FUNCTION update_route_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update route updated_at
CREATE TRIGGER trigger_update_route_updated_at
  BEFORE UPDATE ON routes
  FOR EACH ROW
  EXECUTE FUNCTION update_route_updated_at();

-- Grant permissions
GRANT ALL ON territories TO authenticated;
GRANT ALL ON routes TO authenticated;
GRANT ALL ON door_targets TO authenticated;
GRANT ALL ON door_visits TO authenticated;
GRANT ALL ON route_locations TO authenticated;
GRANT ALL ON leads TO authenticated;
GRANT ALL ON appointments TO authenticated;
GRANT ALL ON follow_up_tasks TO authenticated;

-- Grant sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
