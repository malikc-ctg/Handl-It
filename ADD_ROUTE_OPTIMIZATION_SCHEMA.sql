-- ============================================
-- ROUTE OPTIMIZATION & TERRITORY MANAGEMENT SCHEMA
-- ============================================
-- Extends existing route management schema
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Territory Assignments (reps assigned to territories with capacity settings)
CREATE TABLE IF NOT EXISTS territory_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID REFERENCES territories(id) ON DELETE CASCADE,
  rep_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  max_stops_per_day INTEGER DEFAULT 30,
  max_drive_minutes_per_day INTEGER DEFAULT 480, -- 8 hours
  shift_start_minutes INTEGER DEFAULT 480, -- 8:00 AM in minutes from midnight
  shift_end_minutes INTEGER DEFAULT 1080, -- 6:00 PM
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(territory_id, rep_user_id)
);

-- Route Plans (optimized route plans for reps)
CREATE TABLE IF NOT EXISTS route_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  rep_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  territory_id UUID REFERENCES territories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  route_objective TEXT DEFAULT 'min_travel_time' CHECK (route_objective IN ('min_travel_time', 'max_priority', 'hybrid')),
  stops_source TEXT DEFAULT 'leads' CHECK (stops_source IN ('leads', 'appointments', 'deals', 'mixed')),
  constraints JSONB DEFAULT '{}', -- shiftStart, shiftEnd, maxStops, lunchBreak, serviceDuration
  weights JSONB DEFAULT '{}', -- priorityWeight, recencyWeight, valueWeight
  engine_version TEXT DEFAULT '1.0',
  stats JSONB DEFAULT '{}', -- driveMinutes, serviceMinutes, totalStops, feasibility flags
  diagnostics JSONB DEFAULT '{}', -- excluded stops with reasons
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Route Plan Stops (individual stops in a route plan)
CREATE TABLE IF NOT EXISTS route_plan_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_plan_id UUID REFERENCES route_plans(id) ON DELETE CASCADE,
  stop_type TEXT NOT NULL CHECK (stop_type IN ('lead', 'appointment', 'deal_visit')),
  stop_ref_id UUID, -- References leads.id, appointments.id, or deals.id
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  order_index INTEGER NOT NULL,
  eta_minutes_from_shift_start INTEGER, -- ETA from shift start
  planned_start_minutes INTEGER, -- Planned start time in minutes from midnight
  planned_end_minutes INTEGER, -- Planned end time
  travel_minutes_from_prev DECIMAL(5, 2), -- Travel time from previous stop
  service_duration_minutes INTEGER DEFAULT 15,
  priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  time_window_start_minutes INTEGER, -- Optional time window start
  time_window_end_minutes INTEGER, -- Optional time window end
  must_visit BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  outcome TEXT CHECK (outcome IN ('visited', 'no_answer', 'reschedule', 'not_interested', 'booked_walkthrough', 'skipped')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coverage Cache (cached territory coverage metrics)
CREATE TABLE IF NOT EXISTS coverage_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID REFERENCES territories(id) ON DELETE CASCADE,
  date_bucket DATE NOT NULL, -- Date bucket for the metrics (e.g., daily)
  metrics JSONB NOT NULL, -- totalLeads, leadsTouched7d, leadsUntouched14d, appointments7d, pipelineValue, coverageScore
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(territory_id, date_bucket)
);

-- Add columns to existing territories table if needed
DO $$
BEGIN
  -- Add color column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'territories' AND column_name = 'color') THEN
    ALTER TABLE territories ADD COLUMN color TEXT DEFAULT '#0D47A1';
  END IF;
  
  -- Add priority column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'territories' AND column_name = 'priority') THEN
    ALTER TABLE territories ADD COLUMN priority INTEGER DEFAULT 1;
  END IF;
  
  -- Add active column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'territories' AND column_name = 'active') THEN
    ALTER TABLE territories ADD COLUMN active BOOLEAN DEFAULT TRUE;
  END IF;
  
  -- Ensure geojson column exists (may be named polygon_coordinates)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'territories' AND column_name = 'geojson') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'territories' AND column_name = 'polygon_coordinates') THEN
      ALTER TABLE territories ADD COLUMN geojson JSONB;
      UPDATE territories SET geojson = polygon_coordinates WHERE geojson IS NULL;
    ELSE
      ALTER TABLE territories ADD COLUMN geojson JSONB;
    END IF;
  END IF;
END $$;

-- Add routingEligible column to leads table if it doesn't exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'routing_eligible') THEN
      ALTER TABLE leads ADD COLUMN routing_eligible BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'latitude') THEN
      ALTER TABLE leads ADD COLUMN latitude DECIMAL(10, 8);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'longitude') THEN
      ALTER TABLE leads ADD COLUMN longitude DECIMAL(11, 8);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'last_touched_at') THEN
      ALTER TABLE leads ADD COLUMN last_touched_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'do_not_contact') THEN
      ALTER TABLE leads ADD COLUMN do_not_contact BOOLEAN DEFAULT FALSE;
    END IF;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_territory_assignments_territory_id ON territory_assignments(territory_id);
CREATE INDEX IF NOT EXISTS idx_territory_assignments_rep_user_id ON territory_assignments(rep_user_id);
CREATE INDEX IF NOT EXISTS idx_route_plans_date ON route_plans(date);
CREATE INDEX IF NOT EXISTS idx_route_plans_rep_user_id ON route_plans(rep_user_id);
CREATE INDEX IF NOT EXISTS idx_route_plans_status ON route_plans(status);
CREATE INDEX IF NOT EXISTS idx_route_plan_stops_route_plan_id ON route_plan_stops(route_plan_id);
CREATE INDEX IF NOT EXISTS idx_route_plan_stops_order_index ON route_plan_stops(route_plan_id, order_index);
CREATE INDEX IF NOT EXISTS idx_coverage_cache_territory_date ON coverage_cache(territory_id, date_bucket);
CREATE INDEX IF NOT EXISTS idx_leads_routing_eligible ON leads(routing_eligible) WHERE routing_eligible = TRUE;
CREATE INDEX IF NOT EXISTS idx_leads_location ON leads(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_last_touched ON leads(last_touched_at);

-- Enable Row Level Security
ALTER TABLE territory_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_plan_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE coverage_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for territory_assignments
DROP POLICY IF EXISTS "Users can view territory assignments" ON territory_assignments;
CREATE POLICY "Users can view territory assignments" ON territory_assignments
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      rep_user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'manager', 'client')
      )
    )
  );

DROP POLICY IF EXISTS "Managers can manage territory assignments" ON territory_assignments;
CREATE POLICY "Managers can manage territory assignments" ON territory_assignments
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'manager')
    )
  );

-- RLS Policies for route_plans
DROP POLICY IF EXISTS "Users can view accessible route plans" ON route_plans;
CREATE POLICY "Users can view accessible route plans" ON route_plans
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      rep_user_id = auth.uid() OR
      created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'manager')
      )
    )
  );

DROP POLICY IF EXISTS "Users can create route plans" ON route_plans;
CREATE POLICY "Users can create route plans" ON route_plans
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND (
      rep_user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'manager')
      )
    )
  );

DROP POLICY IF EXISTS "Users can update accessible route plans" ON route_plans;
CREATE POLICY "Users can update accessible route plans" ON route_plans
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      rep_user_id = auth.uid() OR
      created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'manager')
      )
    )
  );

-- RLS Policies for route_plan_stops
DROP POLICY IF EXISTS "Users can view stops for accessible route plans" ON route_plan_stops;
CREATE POLICY "Users can view stops for accessible route plans" ON route_plan_stops
  FOR SELECT USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM route_plans
      WHERE route_plans.id = route_plan_stops.route_plan_id
      AND (
        route_plans.rep_user_id = auth.uid() OR
        route_plans.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'manager')
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage stops for accessible route plans" ON route_plan_stops;
CREATE POLICY "Users can manage stops for accessible route plans" ON route_plan_stops
  FOR ALL USING (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM route_plans
      WHERE route_plans.id = route_plan_stops.route_plan_id
      AND (
        route_plans.rep_user_id = auth.uid() OR
        route_plans.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role IN ('admin', 'manager')
        )
      )
    )
  );

-- RLS Policies for coverage_cache
DROP POLICY IF EXISTS "Users can view coverage cache" ON coverage_cache;
CREATE POLICY "Users can view coverage cache" ON coverage_cache
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      EXISTS (
        SELECT 1 FROM territory_assignments
        WHERE territory_assignments.territory_id = coverage_cache.territory_id
        AND territory_assignments.rep_user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'manager')
      )
    )
  );

DROP POLICY IF EXISTS "Managers can manage coverage cache" ON coverage_cache;
CREATE POLICY "Managers can manage coverage cache" ON coverage_cache
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'manager')
    )
  );

-- Grant permissions
GRANT ALL ON territory_assignments TO authenticated;
GRANT ALL ON route_plans TO authenticated;
GRANT ALL ON route_plan_stops TO authenticated;
GRANT ALL ON coverage_cache TO authenticated;

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_territory_assignment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_territory_assignment_updated_at
  BEFORE UPDATE ON territory_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_territory_assignment_updated_at();

CREATE OR REPLACE FUNCTION update_route_plan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_route_plan_updated_at
  BEFORE UPDATE ON route_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_route_plan_updated_at();

CREATE OR REPLACE FUNCTION update_route_plan_stop_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_route_plan_stop_updated_at
  BEFORE UPDATE ON route_plan_stops
  FOR EACH ROW
  EXECUTE FUNCTION update_route_plan_stop_updated_at();

SELECT '✅ Route Optimization Schema Ready!' as result;
