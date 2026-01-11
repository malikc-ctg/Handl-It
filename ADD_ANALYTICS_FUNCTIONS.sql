-- ============================================
-- NFG Analytics - Database Functions (RPC)
-- ============================================
-- Efficient aggregation functions with RBAC built-in
-- ============================================

-- ============================================
-- Helper Function: Get accessible user IDs based on role
-- ============================================
CREATE OR REPLACE FUNCTION get_accessible_user_ids(requesting_user_id UUID)
RETURNS TABLE(user_id UUID) AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get user role
  SELECT role INTO user_role FROM user_profiles WHERE id = requesting_user_id;
  
  IF user_role = 'admin' THEN
    -- Admin sees all users
    RETURN QUERY SELECT id FROM user_profiles;
  ELSIF user_role IN ('client', 'manager') THEN
    -- Managers see all staff + themselves
    RETURN QUERY SELECT id FROM user_profiles WHERE role = 'staff' OR id = requesting_user_id;
  ELSE
    -- Staff/Rep sees only themselves
    RETURN QUERY SELECT requesting_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 1. FUNNEL METRICS: Calls -> Connections -> Quotes -> Wins
-- ============================================
CREATE OR REPLACE FUNCTION get_funnel_metrics(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  filter_user_id UUID DEFAULT NULL,
  filter_territory TEXT DEFAULT NULL,
  filter_vertical TEXT DEFAULT NULL,
  filter_source TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  accessible_user_ids UUID[];
  requesting_user_id UUID;
  result JSON;
BEGIN
  requesting_user_id := auth.uid();
  
  -- Get accessible user IDs based on role
  SELECT array_agg(user_id) INTO accessible_user_ids
  FROM get_accessible_user_ids(requesting_user_id);
  
  -- Apply user filter if specified and user has access
  IF filter_user_id IS NOT NULL THEN
    IF NOT (filter_user_id = ANY(accessible_user_ids) OR is_user_admin(requesting_user_id)) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;
  
  -- Build date filter
  IF start_date IS NULL THEN start_date := CURRENT_DATE - INTERVAL '30 days'; END IF;
  IF end_date IS NULL THEN end_date := CURRENT_DATE; END IF;
  
  -- Query using event stream (primary source of truth)
  SELECT json_build_object(
    'calls', (
      SELECT COUNT(*) FROM events e
      WHERE e.event_type = 'call'
        AND (filter_user_id IS NULL OR e.user_id = filter_user_id)
        AND e.user_id = ANY(accessible_user_ids)
        AND (filter_territory IS NULL OR e.territory = filter_territory)
        AND (filter_vertical IS NULL OR e.vertical = filter_vertical)
        AND (filter_source IS NULL OR e.source = filter_source)
        AND e.created_at::date BETWEEN start_date AND end_date
    ),
    'connections', (
      SELECT COUNT(*) FROM events e
      WHERE e.event_type = 'connection'
        AND (filter_user_id IS NULL OR e.user_id = filter_user_id)
        AND e.user_id = ANY(accessible_user_ids)
        AND (filter_territory IS NULL OR e.territory = filter_territory)
        AND (filter_vertical IS NULL OR e.vertical = filter_vertical)
        AND (filter_source IS NULL OR e.source = filter_source)
        AND e.created_at::date BETWEEN start_date AND end_date
    ),
    'quotes', (
      SELECT COUNT(*) FROM events e
      WHERE e.event_type = 'quote'
        AND (filter_user_id IS NULL OR e.user_id = filter_user_id)
        AND e.user_id = ANY(accessible_user_ids)
        AND (filter_territory IS NULL OR e.territory = filter_territory)
        AND (filter_vertical IS NULL OR e.vertical = filter_vertical)
        AND (filter_source IS NULL OR e.source = filter_source)
        AND e.created_at::date BETWEEN start_date AND end_date
    ),
    'wins', (
      SELECT COUNT(*) FROM events e
      WHERE e.event_type = 'win'
        AND (filter_user_id IS NULL OR e.user_id = filter_user_id)
        AND e.user_id = ANY(accessible_user_ids)
        AND (filter_territory IS NULL OR e.territory = filter_territory)
        AND (filter_vertical IS NULL OR e.vertical = filter_vertical)
        AND (filter_source IS NULL OR e.source = filter_source)
        AND e.created_at::date BETWEEN start_date AND end_date
    ),
    'conversion_rates', json_build_object(
      'calls_to_connections', CASE WHEN (
        SELECT COUNT(*) FROM events WHERE event_type = 'call' AND user_id = ANY(accessible_user_ids) AND created_at::date BETWEEN start_date AND end_date
      ) > 0 THEN (
        SELECT COUNT(*)::numeric FROM events WHERE event_type = 'connection' AND user_id = ANY(accessible_user_ids) AND created_at::date BETWEEN start_date AND end_date
      ) / (
        SELECT COUNT(*)::numeric FROM events WHERE event_type = 'call' AND user_id = ANY(accessible_user_ids) AND created_at::date BETWEEN start_date AND end_date
      ) * 100 ELSE 0 END,
      'connections_to_quotes', CASE WHEN (
        SELECT COUNT(*) FROM events WHERE event_type = 'connection' AND user_id = ANY(accessible_user_ids) AND created_at::date BETWEEN start_date AND end_date
      ) > 0 THEN (
        SELECT COUNT(*)::numeric FROM events WHERE event_type = 'quote' AND user_id = ANY(accessible_user_ids) AND created_at::date BETWEEN start_date AND end_date
      ) / (
        SELECT COUNT(*)::numeric FROM events WHERE event_type = 'connection' AND user_id = ANY(accessible_user_ids) AND created_at::date BETWEEN start_date AND end_date
      ) * 100 ELSE 0 END,
      'quotes_to_wins', CASE WHEN (
        SELECT COUNT(*) FROM events WHERE event_type = 'quote' AND user_id = ANY(accessible_user_ids) AND created_at::date BETWEEN start_date AND end_date
      ) > 0 THEN (
        SELECT COUNT(*)::numeric FROM events WHERE event_type = 'win' AND user_id = ANY(accessible_user_ids) AND created_at::date BETWEEN start_date AND end_date
      ) / (
        SELECT COUNT(*)::numeric FROM events WHERE event_type = 'quote' AND user_id = ANY(accessible_user_ids) AND created_at::date BETWEEN start_date AND end_date
      ) * 100 ELSE 0 END
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. AVERAGE TIME TO CLOSE BY VERTICAL
-- ============================================
CREATE OR REPLACE FUNCTION get_time_to_close_by_vertical(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  filter_user_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  accessible_user_ids UUID[];
  requesting_user_id UUID;
  result JSON;
BEGIN
  requesting_user_id := auth.uid();
  
  SELECT array_agg(user_id) INTO accessible_user_ids
  FROM get_accessible_user_ids(requesting_user_id);
  
  IF filter_user_id IS NOT NULL THEN
    IF NOT (filter_user_id = ANY(accessible_user_ids) OR is_user_admin(requesting_user_id)) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;
  
  IF start_date IS NULL THEN start_date := CURRENT_DATE - INTERVAL '90 days'; END IF;
  IF end_date IS NULL THEN end_date := CURRENT_DATE; END IF;
  
  SELECT json_agg(
    json_build_object(
      'vertical', w.vertical,
      'average_days', AVG(
        EXTRACT(EPOCH FROM (w.closed_date - COALESCE(w.first_call_date, w.created_at))) / 86400
      ),
      'median_days', percentile_cont(0.5) WITHIN GROUP (ORDER BY 
        EXTRACT(EPOCH FROM (w.closed_date - COALESCE(w.first_call_date, w.created_at))) / 86400
      ),
      'deal_count', COUNT(*),
      'total_value', SUM(w.deal_value)
    )
    ORDER BY AVG(EXTRACT(EPOCH FROM (w.closed_date - COALESCE(w.first_call_date, w.created_at))) / 86400)
  )
  INTO result
  FROM wins w
  WHERE w.user_id = ANY(accessible_user_ids)
    AND (filter_user_id IS NULL OR w.user_id = filter_user_id)
    AND w.closed_date BETWEEN start_date AND end_date
    AND w.vertical IS NOT NULL
  GROUP BY w.vertical;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. CALLS PER CLOSED DEAL
-- ============================================
CREATE OR REPLACE FUNCTION get_calls_per_closed_deal(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  filter_user_id UUID DEFAULT NULL,
  filter_territory TEXT DEFAULT NULL,
  filter_vertical TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  accessible_user_ids UUID[];
  requesting_user_id UUID;
  result JSON;
BEGIN
  requesting_user_id := auth.uid();
  
  SELECT array_agg(user_id) INTO accessible_user_ids
  FROM get_accessible_user_ids(requesting_user_id);
  
  IF filter_user_id IS NOT NULL THEN
    IF NOT (filter_user_id = ANY(accessible_user_ids) OR is_user_admin(requesting_user_id)) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;
  
  IF start_date IS NULL THEN start_date := CURRENT_DATE - INTERVAL '90 days'; END IF;
  IF end_date IS NULL THEN end_date := CURRENT_DATE; END IF;
  
  SELECT json_build_object(
    'average_calls_per_deal', CASE WHEN COUNT(DISTINCT w.id) > 0 THEN
      (
        SELECT COUNT(*)::numeric FROM calls c
        WHERE c.user_id = ANY(accessible_user_ids)
          AND (filter_user_id IS NULL OR c.user_id = filter_user_id)
          AND (filter_territory IS NULL OR c.territory = filter_territory)
          AND (filter_vertical IS NULL OR c.vertical = filter_vertical)
          AND c.created_at::date BETWEEN start_date AND end_date
      ) / COUNT(DISTINCT w.id)::numeric
    ELSE 0 END,
    'total_calls', (
      SELECT COUNT(*) FROM calls c
      WHERE c.user_id = ANY(accessible_user_ids)
        AND (filter_user_id IS NULL OR c.user_id = filter_user_id)
        AND (filter_territory IS NULL OR c.territory = filter_territory)
        AND (filter_vertical IS NULL OR c.vertical = filter_vertical)
        AND c.created_at::date BETWEEN start_date AND end_date
    ),
    'total_deals', COUNT(DISTINCT w.id),
    'by_user', (
      SELECT json_agg(
        json_build_object(
          'user_id', up.id,
          'user_name', up.full_name,
          'calls_count', COUNT(DISTINCT c.id),
          'deals_count', COUNT(DISTINCT w.id),
          'calls_per_deal', CASE WHEN COUNT(DISTINCT w.id) > 0 THEN 
            COUNT(DISTINCT c.id)::numeric / COUNT(DISTINCT w.id)::numeric 
          ELSE 0 END
        )
      )
      FROM user_profiles up
      LEFT JOIN calls c ON c.user_id = up.id
        AND c.created_at::date BETWEEN start_date AND end_date
        AND (filter_territory IS NULL OR c.territory = filter_territory)
        AND (filter_vertical IS NULL OR c.vertical = filter_vertical)
      LEFT JOIN wins w ON w.user_id = up.id
        AND w.closed_date BETWEEN start_date AND end_date
        AND (filter_territory IS NULL OR w.territory = filter_territory)
        AND (filter_vertical IS NULL OR w.vertical = filter_vertical)
      WHERE up.id = ANY(accessible_user_ids)
        AND (filter_user_id IS NULL OR up.id = filter_user_id)
      GROUP BY up.id, up.full_name
    )
  )
  INTO result
  FROM wins w
  WHERE w.user_id = ANY(accessible_user_ids)
    AND (filter_user_id IS NULL OR w.user_id = filter_user_id)
    AND (filter_territory IS NULL OR w.territory = filter_territory)
    AND (filter_vertical IS NULL OR w.vertical = filter_territory)
    AND w.closed_date BETWEEN start_date AND end_date;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. STALLED DEALS (No touch > X days)
-- ============================================
CREATE OR REPLACE FUNCTION get_stalled_deals(
  days_without_touch INTEGER DEFAULT 14,
  filter_user_id UUID DEFAULT NULL,
  filter_territory TEXT DEFAULT NULL,
  filter_vertical TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  accessible_user_ids UUID[];
  requesting_user_id UUID;
  result JSON;
  cutoff_date TIMESTAMPTZ;
BEGIN
  requesting_user_id := auth.uid();
  
  SELECT array_agg(user_id) INTO accessible_user_ids
  FROM get_accessible_user_ids(requesting_user_id);
  
  IF filter_user_id IS NOT NULL THEN
    IF NOT (filter_user_id = ANY(accessible_user_ids) OR is_user_admin(requesting_user_id)) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;
  
  cutoff_date := NOW() - (days_without_touch || ' days')::INTERVAL;
  
  -- Find sites/quotes that have activity but no recent touch
  SELECT json_agg(
    json_build_object(
      'site_id', s.id,
      'site_name', s.name,
      'last_activity_date', (
        SELECT MAX(created_at) FROM events
        WHERE site_id = s.id
          AND event_type IN ('call', 'connection', 'quote')
      ),
      'days_since_touch', EXTRACT(EPOCH FROM (NOW() - (
        SELECT MAX(created_at) FROM events
        WHERE site_id = s.id
          AND event_type IN ('call', 'connection', 'quote')
      ))) / 86400)::INTEGER,
      'last_quote_value', (
        SELECT quote_value FROM quotes
        WHERE site_id = s.id
        ORDER BY quote_date DESC
        LIMIT 1
      ),
      'assigned_user_id', q.user_id,
      'assigned_user_name', up.full_name,
      'territory', q.territory,
      'vertical', q.vertical
    )
    ORDER BY (
      SELECT MAX(created_at) FROM events
      WHERE site_id = s.id
    ) ASC
  )
  INTO result
  FROM sites s
  INNER JOIN quotes q ON q.site_id = s.id
  LEFT JOIN user_profiles up ON up.id = q.user_id
  WHERE q.user_id = ANY(accessible_user_ids)
    AND (filter_user_id IS NULL OR q.user_id = filter_user_id)
    AND (filter_territory IS NULL OR q.territory = filter_territory)
    AND (filter_vertical IS NULL OR q.vertical = filter_vertical)
    AND q.status IN ('sent', 'negotiating')
    AND (
      SELECT MAX(created_at) FROM events
      WHERE site_id = s.id
        AND event_type IN ('call', 'connection', 'quote')
    ) < cutoff_date
    AND NOT EXISTS (
      SELECT 1 FROM wins WHERE site_id = s.id
    );
  
  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. ROUTE METRICS: Doors Knocked Per Hour
-- ============================================
CREATE OR REPLACE FUNCTION get_doors_knocked_per_hour(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  filter_user_id UUID DEFAULT NULL,
  filter_territory TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  accessible_user_ids UUID[];
  requesting_user_id UUID;
  result JSON;
BEGIN
  requesting_user_id := auth.uid();
  
  SELECT array_agg(user_id) INTO accessible_user_ids
  FROM get_accessible_user_ids(requesting_user_id);
  
  IF filter_user_id IS NOT NULL THEN
    IF NOT (filter_user_id = ANY(accessible_user_ids) OR is_user_admin(requesting_user_id)) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;
  
  IF start_date IS NULL THEN start_date := CURRENT_DATE - INTERVAL '30 days'; END IF;
  IF end_date IS NULL THEN end_date := CURRENT_DATE; END IF;
  
  SELECT json_build_object(
    'overall_average', CASE WHEN COUNT(*) > 0 THEN
      (
        SELECT COUNT(*)::numeric / GREATEST(SUM(EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600), 1)
        FROM time_entries te
        WHERE te.user_id = ANY(accessible_user_ids)
          AND (filter_user_id IS NULL OR te.user_id = filter_user_id)
          AND te.clock_in::date BETWEEN start_date AND end_date
          AND te.clock_out IS NOT NULL
      )
    ELSE 0 END,
    'by_user', (
      SELECT json_agg(
        json_build_object(
          'user_id', up.id,
          'user_name', up.full_name,
          'total_knocks', COUNT(DISTINCT dk.id),
          'total_hours', COALESCE(SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600), 0),
          'knocks_per_hour', CASE WHEN SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600) > 0 THEN
            COUNT(DISTINCT dk.id)::numeric / SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600)
          ELSE 0 END
        )
      )
      FROM user_profiles up
      LEFT JOIN door_knocks dk ON dk.user_id = up.id
        AND dk.knock_time::date BETWEEN start_date AND end_date
        AND (filter_territory IS NULL OR dk.territory = filter_territory)
      LEFT JOIN time_entries te ON te.user_id = up.id
        AND te.clock_in::date BETWEEN start_date AND end_date
        AND te.clock_out IS NOT NULL
      WHERE up.id = ANY(accessible_user_ids)
        AND (filter_user_id IS NULL OR up.id = filter_user_id)
      GROUP BY up.id, up.full_name
    ),
    'by_territory', (
      SELECT json_agg(
        json_build_object(
          'territory', dk.territory,
          'total_knocks', COUNT(DISTINCT dk.id),
          'total_hours', COALESCE(SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600), 0),
          'knocks_per_hour', CASE WHEN SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600) > 0 THEN
            COUNT(DISTINCT dk.id)::numeric / SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600)
          ELSE 0 END
        )
      )
      FROM door_knocks dk
      LEFT JOIN time_entries te ON te.user_id = dk.user_id
        AND te.clock_in::date BETWEEN start_date AND end_date
        AND te.clock_out IS NOT NULL
      WHERE dk.user_id = ANY(accessible_user_ids)
        AND (filter_user_id IS NULL OR dk.user_id = filter_user_id)
        AND dk.knock_time::date BETWEEN start_date AND end_date
        AND (filter_territory IS NULL OR dk.territory = filter_territory)
      GROUP BY dk.territory
    )
  )
  INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. ROUTE METRICS: Appointments Per Hour
-- ============================================
CREATE OR REPLACE FUNCTION get_appointments_per_hour(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  filter_user_id UUID DEFAULT NULL,
  filter_territory TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  accessible_user_ids UUID[];
  requesting_user_id UUID;
  result JSON;
BEGIN
  requesting_user_id := auth.uid();
  
  SELECT array_agg(user_id) INTO accessible_user_ids
  FROM get_accessible_user_ids(requesting_user_id);
  
  IF filter_user_id IS NOT NULL THEN
    IF NOT (filter_user_id = ANY(accessible_user_ids) OR is_user_admin(requesting_user_id)) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;
  
  IF start_date IS NULL THEN start_date := CURRENT_DATE - INTERVAL '30 days'; END IF;
  IF end_date IS NULL THEN end_date := CURRENT_DATE; END IF;
  
  SELECT json_build_object(
    'overall_average', CASE WHEN COUNT(*) > 0 THEN
      (
        SELECT COUNT(*)::numeric / GREATEST(SUM(EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600), 1)
        FROM time_entries te
        WHERE te.user_id = ANY(accessible_user_ids)
          AND (filter_user_id IS NULL OR te.user_id = filter_user_id)
          AND te.clock_in::date BETWEEN start_date AND end_date
          AND te.clock_out IS NOT NULL
      )
    ELSE 0 END,
    'by_user', (
      SELECT json_agg(
        json_build_object(
          'user_id', up.id,
          'user_name', up.full_name,
          'total_appointments', COUNT(DISTINCT ap.id),
          'total_hours', COALESCE(SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600), 0),
          'appointments_per_hour', CASE WHEN SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600) > 0 THEN
            COUNT(DISTINCT ap.id)::numeric / SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600)
          ELSE 0 END
        )
      )
      FROM user_profiles up
      LEFT JOIN appointments ap ON ap.user_id = up.id
        AND ap.appointment_time::date BETWEEN start_date AND end_date
        AND (filter_territory IS NULL OR ap.territory = filter_territory)
      LEFT JOIN time_entries te ON te.user_id = up.id
        AND te.clock_in::date BETWEEN start_date AND end_date
        AND te.clock_out IS NOT NULL
      WHERE up.id = ANY(accessible_user_ids)
        AND (filter_user_id IS NULL OR up.id = filter_user_id)
      GROUP BY up.id, up.full_name
    )
  )
  INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. CONVERSION BY TERRITORY
-- ============================================
CREATE OR REPLACE FUNCTION get_conversion_by_territory(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  filter_user_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  accessible_user_ids UUID[];
  requesting_user_id UUID;
  result JSON;
BEGIN
  requesting_user_id := auth.uid();
  
  SELECT array_agg(user_id) INTO accessible_user_ids
  FROM get_accessible_user_ids(requesting_user_id);
  
  IF filter_user_id IS NOT NULL THEN
    IF NOT (filter_user_id = ANY(accessible_user_ids) OR is_user_admin(requesting_user_id)) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;
  
  IF start_date IS NULL THEN start_date := CURRENT_DATE - INTERVAL '90 days'; END IF;
  IF end_date IS NULL THEN end_date := CURRENT_DATE; END IF;
  
  SELECT json_agg(
    json_build_object(
      'territory', territory,
      'door_knocks', COUNT(DISTINCT CASE WHEN e.event_type = 'door_knock' THEN e.id END),
      'appointments', COUNT(DISTINCT CASE WHEN e.event_type = 'appointment' THEN e.id END),
      'calls', COUNT(DISTINCT CASE WHEN e.event_type = 'call' THEN e.id END),
      'connections', COUNT(DISTINCT CASE WHEN e.event_type = 'connection' THEN e.id END),
      'quotes', COUNT(DISTINCT CASE WHEN e.event_type = 'quote' THEN e.id END),
      'wins', COUNT(DISTINCT CASE WHEN e.event_type = 'win' THEN e.id END),
      'knock_to_appointment_rate', CASE WHEN COUNT(DISTINCT CASE WHEN e.event_type = 'door_knock' THEN e.id END) > 0 THEN
        COUNT(DISTINCT CASE WHEN e.event_type = 'appointment' THEN e.id END)::numeric /
        COUNT(DISTINCT CASE WHEN e.event_type = 'door_knock' THEN e.id END)::numeric * 100
      ELSE 0 END,
      'quote_to_win_rate', CASE WHEN COUNT(DISTINCT CASE WHEN e.event_type = 'quote' THEN e.id END) > 0 THEN
        COUNT(DISTINCT CASE WHEN e.event_type = 'win' THEN e.id END)::numeric /
        COUNT(DISTINCT CASE WHEN e.event_type = 'quote' THEN e.id END)::numeric * 100
      ELSE 0 END,
      'total_deal_value', COALESCE(SUM(CASE WHEN e.event_type = 'win' THEN (e.metadata->>'value')::numeric ELSE 0 END), 0)
    )
    ORDER BY COUNT(DISTINCT CASE WHEN e.event_type = 'win' THEN e.id END) DESC
  )
  INTO result
  FROM events e
  WHERE e.user_id = ANY(accessible_user_ids)
    AND (filter_user_id IS NULL OR e.user_id = filter_user_id)
    AND e.territory IS NOT NULL
    AND e.created_at::date BETWEEN start_date AND end_date
  GROUP BY e.territory;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. BEST TIME OF DAY FOR ACTIVITY
-- ============================================
CREATE OR REPLACE FUNCTION get_best_time_of_day(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  filter_user_id UUID DEFAULT NULL,
  activity_type TEXT DEFAULT 'door_knock' -- 'door_knock', 'appointment', 'call'
)
RETURNS JSON AS $$
DECLARE
  accessible_user_ids UUID[];
  requesting_user_id UUID;
  result JSON;
BEGIN
  requesting_user_id := auth.uid();
  
  SELECT array_agg(user_id) INTO accessible_user_ids
  FROM get_accessible_user_ids(requesting_user_id);
  
  IF filter_user_id IS NOT NULL THEN
    IF NOT (filter_user_id = ANY(accessible_user_ids) OR is_user_admin(requesting_user_id)) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;
  
  IF start_date IS NULL THEN start_date := CURRENT_DATE - INTERVAL '90 days'; END IF;
  IF end_date IS NULL THEN end_date := CURRENT_DATE; END IF;
  
  -- For door_knocks, use knock_time; for appointments, use appointment_time; for calls, use created_at
  IF activity_type = 'door_knock' THEN
    SELECT json_agg(
      json_build_object(
        'hour', EXTRACT(HOUR FROM dk.knock_time),
        'hour_label', TO_CHAR(dk.knock_time, 'HH24:00'),
        'activity_count', COUNT(*),
        'conversion_rate', CASE WHEN COUNT(*) > 0 THEN
          COUNT(CASE WHEN dk.outcome IN ('appointment_scheduled', 'interested') THEN 1 END)::numeric / COUNT(*)::numeric * 100
        ELSE 0 END
      )
      ORDER BY COUNT(*) DESC
    )
    INTO result
    FROM door_knocks dk
    WHERE dk.user_id = ANY(accessible_user_ids)
      AND (filter_user_id IS NULL OR dk.user_id = filter_user_id)
      AND dk.knock_time::date BETWEEN start_date AND end_date
    GROUP BY EXTRACT(HOUR FROM dk.knock_time);
  ELSIF activity_type = 'appointment' THEN
    SELECT json_agg(
      json_build_object(
        'hour', EXTRACT(HOUR FROM ap.appointment_time),
        'hour_label', TO_CHAR(ap.appointment_time, 'HH24:00'),
        'activity_count', COUNT(*),
        'completion_rate', CASE WHEN COUNT(*) > 0 THEN
          COUNT(CASE WHEN ap.status = 'completed' THEN 1 END)::numeric / COUNT(*)::numeric * 100
        ELSE 0 END
      )
      ORDER BY COUNT(*) DESC
    )
    INTO result
    FROM appointments ap
    WHERE ap.user_id = ANY(accessible_user_ids)
      AND (filter_user_id IS NULL OR ap.user_id = filter_user_id)
      AND ap.appointment_time::date BETWEEN start_date AND end_date
    GROUP BY EXTRACT(HOUR FROM ap.appointment_time);
  ELSE -- calls
    SELECT json_agg(
      json_build_object(
        'hour', EXTRACT(HOUR FROM e.created_at),
        'hour_label', TO_CHAR(e.created_at, 'HH24:00'),
        'activity_count', COUNT(*),
        'answer_rate', CASE WHEN COUNT(*) > 0 THEN
          COUNT(CASE WHEN (e.metadata->>'outcome') = 'answered' THEN 1 END)::numeric / COUNT(*)::numeric * 100
        ELSE 0 END
      )
      ORDER BY COUNT(*) DESC
    )
    INTO result
    FROM events e
    WHERE e.event_type = 'call'
      AND e.user_id = ANY(accessible_user_ids)
      AND (filter_user_id IS NULL OR e.user_id = filter_user_id)
      AND e.created_at::date BETWEEN start_date AND end_date
    GROUP BY EXTRACT(HOUR FROM e.created_at);
  END IF;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_funnel_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_time_to_close_by_vertical TO authenticated;
GRANT EXECUTE ON FUNCTION get_calls_per_closed_deal TO authenticated;
GRANT EXECUTE ON FUNCTION get_stalled_deals TO authenticated;
GRANT EXECUTE ON FUNCTION get_doors_knocked_per_hour TO authenticated;
GRANT EXECUTE ON FUNCTION get_appointments_per_hour TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversion_by_territory TO authenticated;
GRANT EXECUTE ON FUNCTION get_best_time_of_day TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ ANALYTICS FUNCTIONS CREATED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Functions Available:';
  RAISE NOTICE '   • get_funnel_metrics';
  RAISE NOTICE '   • get_time_to_close_by_vertical';
  RAISE NOTICE '   • get_calls_per_closed_deal';
  RAISE NOTICE '   • get_stalled_deals';
  RAISE NOTICE '   • get_doors_knocked_per_hour';
  RAISE NOTICE '   • get_appointments_per_hour';
  RAISE NOTICE '   • get_conversion_by_territory';
  RAISE NOTICE '   • get_best_time_of_day';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 All functions include RBAC!';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
