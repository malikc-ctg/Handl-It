// ============================================
// Run Workflow Automations Edge Function
// ============================================
// Executes: auto-assign jobs, escalate overdue, send reminders
// Call via cron (X-Cron-Secret) or manual (admin auth)
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const cronSecret = Deno.env.get('CRON_SECRET')
    const cronHeader = req.headers.get('X-Cron-Secret')
    const authHeader = req.headers.get('Authorization')

    if (!cronSecret || cronHeader !== cronSecret) {
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error } = await supabaseAuth.auth.getUser(token)
      if (error || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { data: profile } = await supabaseAuth.from('user_profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: 'Admin required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const results = {
      auto_assign: { assigned: 0, jobs: [] as string[] },
      overdue: { notified: 0, jobs: [] as string[] },
      job_reminders: { sent: 0, jobs: [] as string[] },
      deal_reminders: { sent: 0, deals: [] as string[] },
      errors: [] as string[],
    }

    // 1. Fetch enabled rules
    const { data: rules, error: rulesError } = await supabase
      .from('workflow_automation_rules')
      .select('*')
      .eq('enabled', true)

    if (rulesError) {
      results.errors.push(`Rules fetch: ${rulesError.message}`)
      return jsonResponse(500, { success: false, ...results })
    }

    const ruleMap = (rules || []).reduce((acc: Record<string, any>, r) => {
      acc[r.rule_type] = r
      return acc
    }, {})

    // 2. Auto-assign jobs (site-based: pick worker assigned to site with fewest jobs)
    const autoAssignRule = ruleMap['auto_assign_jobs']
    if (autoAssignRule) {
      const config = autoAssignRule.config || {}
      const strategy = config.strategy || 'site_based'

      const { data: unassignedJobs } = await supabase
        .from('jobs')
        .select('id, site_id')
        .is('assigned_worker_id', null)
        .in('status', ['pending', 'in-progress'])
        .not('site_id', 'is', null)

      for (const job of unassignedJobs || []) {
        let workerId: string | null = null

        if (strategy === 'site_based') {
          const { data: siteWorkers } = await supabase
            .from('worker_site_assignments')
            .select('worker_id')
            .eq('site_id', job.site_id)

          if (siteWorkers?.length) {
            const workerIds = siteWorkers.map((w: any) => w.worker_id)
            const { data: counts } = await supabase
              .from('jobs')
              .select('assigned_worker_id')
              .in('assigned_worker_id', workerIds)
              .in('status', ['pending', 'in-progress'])

            const countByWorker: Record<string, number> = {}
            for (const c of counts || []) {
              const w = c.assigned_worker_id
              if (w) countByWorker[w] = (countByWorker[w] || 0) + 1
            }
            workerId = workerIds.reduce((a: string, b: string) =>
              (countByWorker[a] ?? 0) <= (countByWorker[b] ?? 0) ? a : b
            )
          }
        }

        if (strategy === 'round_robin' && !workerId) {
          const { data: workers } = await supabase.from('user_profiles').select('id').in('role', ['staff', 'worker', 'manager'])
          if (workers?.length) {
            const idx = Math.floor(Math.random() * workers.length)
            workerId = workers[idx].id
          }
        }

        if (workerId) {
          const { error: updErr } = await supabase
            .from('jobs')
            .update({ assigned_worker_id: workerId })
            .eq('id', job.id)

          if (!updErr) {
            results.auto_assign.assigned++
            results.auto_assign.jobs.push(String(job.id))
            await logAutomation(supabase, 'auto_assign_jobs', autoAssignRule.id, 'auto_assigned', 'job', job.id, {
              assigned_to: workerId,
              reason: strategy,
            }, `Job auto-assigned by workflow (${strategy}) at ${new Date().toISOString()}`)

            await createNotification(supabase, workerId, 'job_assigned', 'Job assigned', `You were assigned to a job.`, `/jobs.html`)
            try {
              await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  user_id: workerId,
                  title: 'Job assigned',
                  body: 'You were assigned to a job.',
                  url: '/jobs.html',
                }),
              })
            } catch (_) {}
          }
        }
      }
    }

    // 3. Escalate overdue jobs
    const overdueRule = ruleMap['escalate_overdue']
    if (overdueRule) {
      const config = overdueRule.config || {}
      const daysOverdue = config.days_overdue ?? 1
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - daysOverdue)
      const cutoffStr = cutoff.toISOString().split('T')[0]

      const { data: overdueJobs } = await supabase
        .from('jobs')
        .select('id, title, assigned_worker_id, scheduled_date')
        .in('status', ['pending', 'in-progress'])
        .lt('scheduled_date', cutoffStr)

      const { data: admins } = await supabase
        .from('user_profiles')
        .select('id')
        .in('role', ['admin', 'super_admin'])

      const adminIds = (admins || []).map((a: any) => a.id)

      for (const job of overdueJobs || []) {
        const notifyIds = new Set<string>()
        if (config.notify_assigned !== false && job.assigned_worker_id) notifyIds.add(job.assigned_worker_id)
        if (config.notify_admins) adminIds.forEach((id: string) => notifyIds.add(id))

        for (const uid of notifyIds) {
          await createNotification(
            supabase,
            uid,
            'job_updated',
            'Overdue job',
            `Job "${job.title}" is overdue (scheduled ${job.scheduled_date}).`,
            `/jobs.html`
          )
        }
        results.overdue.notified++
        results.overdue.jobs.push(String(job.id))
        await logAutomation(supabase, 'escalate_overdue', overdueRule.id, 'overdue_notified', 'job', job.id, {}, `Overdue job escalated at ${new Date().toISOString()}`)
      }
    }

    // 4. Job due reminders (e.g. due tomorrow)
    const jobReminderRule = ruleMap['job_due_reminders']
    if (jobReminderRule) {
      const config = jobReminderRule.config || {}
      const daysBefore = config.days_before || [1]
      const today = new Date()

      for (const d of daysBefore) {
        const targetDate = new Date(today)
        targetDate.setDate(targetDate.getDate() + d)
        const targetStr = targetDate.toISOString().split('T')[0]

        const { data: dueJobs } = await supabase
          .from('jobs')
          .select('id, title, assigned_worker_id, scheduled_date')
          .eq('scheduled_date', targetStr)
          .in('status', ['pending', 'in-progress'])

        for (const job of dueJobs || []) {
          const notifyId = config.notify_assigned !== false ? job.assigned_worker_id : null
          if (notifyId) {
            await createNotification(
              supabase,
              notifyId,
              'job_updated',
              'Job due soon',
              `Job "${job.title}" is due ${d === 0 ? 'today' : `in ${d} day(s)`} (${job.scheduled_date}).`,
              `/jobs.html`
            )
            results.job_reminders.sent++
            results.job_reminders.jobs.push(String(job.id))
            await logAutomation(supabase, 'job_due_reminders', jobReminderRule.id, 'reminder_sent', 'job', job.id, {}, `Due reminder sent at ${new Date().toISOString()}`)
          }
        }
      }
    }

    // 5. Deal follow-up reminders (no touch in X days)
    const dealReminderRule = ruleMap['deal_follow_up_reminders']
    if (dealReminderRule) {
      const config = dealReminderRule.config || {}
      const daysWithoutTouch = config.days_without_touch ?? 3
      const stages = config.stages || ['qualification', 'proposal', 'negotiation']
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - daysWithoutTouch)

      const { data: deals } = await supabase
        .from('deals')
        .select('id, title, assigned_user_id, assigned_to, last_touch_at, stage, created_at')
        .in('stage', stages)

      for (const deal of deals || []) {
        const lastTouch = deal.last_touch_at ? new Date(deal.last_touch_at) : new Date(deal.created_at || '1970-01-01')
        if (lastTouch >= cutoff) continue

        const assigneeId = deal.assigned_user_id || deal.assigned_to
        if (assigneeId && config.notify_assigned !== false) {
          await createNotification(
            supabase,
            assigneeId,
            'system',
            'Deal follow-up reminder',
            `Deal "${deal.title}" hasn't been touched in ${daysWithoutTouch}+ days. Consider following up.`,
            `/sales.html`
          )
          results.deal_reminders.sent++
          results.deal_reminders.deals.push(String(deal.id))
          await logAutomation(supabase, 'deal_follow_up_reminders', dealReminderRule.id, 'reminder_sent', 'deal', deal.id, {}, `Follow-up reminder sent at ${new Date().toISOString()}`)
        }
      }
    }

    return jsonResponse(200, { success: true, ...results })
  } catch (err) {
    console.error('Workflow automations error:', err)
    return jsonResponse(500, {
      success: false,
      error: (err as Error).message,
      errors: [(err as Error).message],
    })
  }
})

function jsonResponse(status: number, body: object) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function logAutomation(
  supabase: any,
  ruleType: string,
  ruleId: string | null,
  action: string,
  entityType: string,
  entityId: string | number,
  details: object,
  message: string
) {
  await supabase.from('workflow_automation_log').insert({
    rule_type: ruleType,
    rule_id: ruleId,
    action,
    entity_type: entityType,
    entity_id: String(entityId),
    details,
    message,
  })
}

async function createNotification(
  supabase: any,
  userId: string,
  type: string,
  title: string,
  message: string,
  link: string
) {
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    link,
    read: false,
    metadata: { automation: true, sent_at: new Date().toISOString() },
  })
}
