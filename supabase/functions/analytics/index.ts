// Supabase Edge Function for Analytics API
// Provides REST endpoints for all analytics queries

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface QueryParams {
  start_date?: string
  end_date?: string
  user_id?: string
  territory?: string
  vertical?: string
  source?: string
  days_without_touch?: number
  activity_type?: 'door_knock' | 'appointment' | 'call'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with user's auth token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse URL and route
    const url = new URL(req.url)
    const path = url.pathname.replace('/functions/v1/analytics', '')
    const params = parseQueryParams(url.searchParams)

    // Route to appropriate function
    let result: any
    let error: Error | null = null

    try {
      switch (path) {
        case '/funnel':
          result = await supabase.rpc('get_funnel_metrics', {
            start_date: params.start_date || null,
            end_date: params.end_date || null,
            filter_user_id: params.user_id || null,
            filter_territory: params.territory || null,
            filter_vertical: params.vertical || null,
            filter_source: params.source || null,
          })
          break

        case '/time-to-close':
          result = await supabase.rpc('get_time_to_close_by_vertical', {
            start_date: params.start_date || null,
            end_date: params.end_date || null,
            filter_user_id: params.user_id || null,
          })
          break

        case '/calls-per-deal':
          result = await supabase.rpc('get_calls_per_closed_deal', {
            start_date: params.start_date || null,
            end_date: params.end_date || null,
            filter_user_id: params.user_id || null,
            filter_territory: params.territory || null,
            filter_vertical: params.vertical || null,
          })
          break

        case '/stalled-deals':
          result = await supabase.rpc('get_stalled_deals', {
            days_without_touch: params.days_without_touch || 14,
            filter_user_id: params.user_id || null,
            filter_territory: params.territory || null,
            filter_vertical: params.vertical || null,
          })
          break

        case '/doors-per-hour':
          result = await supabase.rpc('get_doors_knocked_per_hour', {
            start_date: params.start_date || null,
            end_date: params.end_date || null,
            filter_user_id: params.user_id || null,
            filter_territory: params.territory || null,
          })
          break

        case '/appointments-per-hour':
          result = await supabase.rpc('get_appointments_per_hour', {
            start_date: params.start_date || null,
            end_date: params.end_date || null,
            filter_user_id: params.user_id || null,
            filter_territory: params.territory || null,
          })
          break

        case '/conversion-by-territory':
          result = await supabase.rpc('get_conversion_by_territory', {
            start_date: params.start_date || null,
            end_date: params.end_date || null,
            filter_user_id: params.user_id || null,
          })
          break

        case '/best-time-of-day':
          result = await supabase.rpc('get_best_time_of_day', {
            start_date: params.start_date || null,
            end_date: params.end_date || null,
            filter_user_id: params.user_id || null,
            activity_type: params.activity_type || 'door_knock',
          })
          break

        default:
          return new Response(
            JSON.stringify({ 
              error: 'Not found',
              available_endpoints: [
                '/funnel',
                '/time-to-close',
                '/calls-per-deal',
                '/stalled-deals',
                '/doors-per-hour',
                '/appointments-per-hour',
                '/conversion-by-territory',
                '/best-time-of-day',
              ]
            }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
      }

      if (result.error) {
        throw new Error(result.error.message)
      }

      return new Response(
        JSON.stringify({ data: result.data }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } catch (err) {
      console.error('Error executing query:', err)
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function parseQueryParams(searchParams: URLSearchParams): QueryParams {
  return {
    start_date: searchParams.get('start_date') || undefined,
    end_date: searchParams.get('end_date') || undefined,
    user_id: searchParams.get('user_id') || undefined,
    territory: searchParams.get('territory') || undefined,
    vertical: searchParams.get('vertical') || undefined,
    source: searchParams.get('source') || undefined,
    days_without_touch: searchParams.get('days_without_touch') 
      ? parseInt(searchParams.get('days_without_touch')!) 
      : undefined,
    activity_type: searchParams.get('activity_type') as 'door_knock' | 'appointment' | 'call' | undefined,
  }
}
