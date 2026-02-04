/**
 * Workflow Automations - Settings UI
 * Load rules, toggle enabled, run manually, show log
 */
import { supabase, SUPABASE_URL } from './supabase.js'
import { toast } from './notifications.js'

export async function initWorkflowAutomations() {
  const section = document.getElementById('workflow-automations-section')
  if (!section) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
    section.classList.add('hidden')
    return
  }

  await loadWorkflowRules()
  await loadWorkflowLog()
  setupRunNowButton()
  if (window.lucide) lucide.createIcons()
}

async function loadWorkflowRules() {
  const list = document.getElementById('workflow-rules-list')
  if (!list) return

  const { data: rules, error } = await supabase
    .from('workflow_automation_rules')
    .select('*')
    .order('rule_type')

  if (error) {
    list.innerHTML = `<p class="text-sm text-red-500">Failed to load: ${error.message}</p>`
    return
  }

  list.innerHTML = (rules || []).map(r => `
    <label class="flex items-center justify-between p-3 border border-nfgray dark:border-gray-700 rounded-lg hover:bg-nfglight/50 dark:hover:bg-gray-700/30 cursor-pointer">
      <div>
        <span class="font-medium text-sm">${escapeHtml(r.name)}</span>
        <span class="ml-2 text-xs text-gray-500 dark:text-gray-400">${r.rule_type}</span>
      </div>
      <input type="checkbox" data-rule-id="${r.id}" ${r.enabled ? 'checked' : ''} 
        class="w-4 h-4 text-nfgblue rounded focus:ring-nfgblue">
    </label>
  `).join('')

  list.querySelectorAll('input[data-rule-id]').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const id = e.target.dataset.ruleId
      const enabled = e.target.checked
      const { error } = await supabase
        .from('workflow_automation_rules')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) {
        toast.error(`Failed to update: ${error.message}`)
        e.target.checked = !enabled
      } else {
        toast.success(enabled ? 'Rule enabled' : 'Rule disabled')
      }
    })
  })
}

async function loadWorkflowLog() {
  const list = document.getElementById('workflow-log-list')
  if (!list) return

  const { data: logs, error } = await supabase
    .from('workflow_automation_log')
    .select('rule_type, action, entity_type, message, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error || !logs?.length) {
    list.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No recent activity</p>'
    return
  }

  list.innerHTML = logs.map(l => `
    <div class="text-xs py-1 border-b border-nfgray/50 dark:border-gray-700/50 last:border-0">
      <span class="text-gray-500 dark:text-gray-400">${new Date(l.created_at).toLocaleString()}</span>
      — ${escapeHtml(l.message || `${l.rule_type}: ${l.action}`)}
    </div>
  `).join('')
}

function setupRunNowButton() {
  const btn = document.getElementById('run-workflow-now-btn')
  if (!btn) return

  btn.addEventListener('click', async () => {
    btn.disabled = true
    const icon = btn.querySelector('i[data-lucide="play"]')
    if (icon) icon.setAttribute('data-lucide', 'loader')
    if (window.lucide) lucide.createIcons()

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`${SUPABASE_URL}/functions/v1/run-workflow-automations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      const json = await res.json()

      if (!res.ok) throw new Error(json.error || 'Request failed')

      const { auto_assign, overdue, job_reminders, deal_reminders } = json
      const parts = []
      if (auto_assign?.assigned) parts.push(`${auto_assign.assigned} job(s) auto-assigned`)
      if (overdue?.notified) parts.push(`${overdue.notified} overdue escalated`)
      if (job_reminders?.sent) parts.push(`${job_reminders.sent} job reminder(s)`)
      if (deal_reminders?.sent) parts.push(`${deal_reminders.sent} deal reminder(s)`)
      const msg = parts.length ? parts.join(', ') : 'Run complete (no actions needed)'
      toast.success(msg)

      await loadWorkflowLog()
    } catch (err) {
      toast.error(err.message || 'Failed to run automations')
    } finally {
      btn.disabled = false
      const icon2 = btn.querySelector('i[data-lucide="loader"]')
      if (icon2) icon2.setAttribute('data-lucide', 'play')
      if (window.lucide) lucide.createIcons()
    }
  })
}

function escapeHtml(s) {
  if (!s) return ''
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}
