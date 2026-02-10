// ============================================
// Send Clock-Out Reminders Edge Function
// ============================================
// Notifies users who have been clocked in for 12+ hours
// to remind them to clock out (or that we noticed they're still working).
// Run via cron every hour (e.g. 0 * * * *) or a few times per day.
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const cutoff = new Date(Date.now() - TWELVE_HOURS_MS).toISOString()

    // Find time_entries still clocked in (clock_out IS NULL) that started 12+ hours ago
    const { data: longEntries, error: fetchError } = await supabase
      .from('time_entries')
      .select('id, user_id, clock_in')
      .is('clock_out', null)
      .lt('clock_in', cutoff)
      .order('clock_in', { ascending: true })

    if (fetchError) {
      console.error('Failed to fetch time_entries:', fetchError)
      throw new Error(`Failed to fetch time_entries: ${fetchError.message}`)
    }

    const entries = longEntries ?? []
    if (entries.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No users clocked in 12+ hours',
          count: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Avoid sending duplicate reminders for the same time_entry (e.g. if cron runs hourly)
    const { data: existing } = await supabase
      .from('notifications')
      .select('metadata')
      .eq('type', 'system')
      .filter('metadata->>reminder_type', 'eq', 'clock_out_12h')

    const alreadySent = new Set<string>()
    for (const n of existing ?? []) {
      const meta = n.metadata as { time_entry_id?: string }
      if (meta?.time_entry_id) alreadySent.add(String(meta.time_entry_id))
    }

    const toNotify = entries.filter((e) => !alreadySent.has(String(e.id)))
    if (toNotify.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Reminders already sent for current long sessions',
          count: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const notifications = toNotify.map((entry) => ({
      user_id: entry.user_id,
      type: 'system',
      title: 'Still working?',
      message:
        "You've been clocked in for over 12 hours. Don't forget to clock out when you're done, or tap here to open the time clock.",
      link: null,
      read: false,
      metadata: {
        reminder_type: 'clock_out_12h',
        time_entry_id: entry.id,
        clock_in: entry.clock_in,
        sent_at: new Date().toISOString(),
      },
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('notifications')
      .insert(notifications)
      .select('id')

    if (insertError) {
      console.error('Failed to insert notifications:', insertError)
      throw new Error(`Failed to create notifications: ${insertError.message}`)
    }

    const count = inserted?.length ?? 0
    console.log(`Sent ${count} clock-out reminder(s) for users clocked in 12+ hours`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Clock-out reminders sent',
        users_notified: count,
        time_entries_checked: entries.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in send-clock-out-reminders:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message ?? 'Unknown error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
