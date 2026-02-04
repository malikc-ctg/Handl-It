# Workflow Automations Setup

## Overview

Automated workflows for:
1. **Auto-assign jobs** – Assign unassigned jobs to workers by site (least workload)
2. **Escalate overdue** – Notify assigned worker + admins when jobs are overdue
3. **Job due reminders** – Remind assignees when jobs are due tomorrow
4. **Deal follow-up reminders** – Remind deal owners when deals haven’t been touched in 3+ days

## Setup Steps

### 1. Run SQL schema

In Supabase → SQL Editor, run:

```
ADD_WORKFLOW_AUTOMATIONS_SCHEMA.sql
```

This creates:
- `workflow_automation_rules` – configurable rules
- `workflow_automation_log` – run history
- Default rules (enabled)

### 2. Deploy Edge Function

```bash
supabase functions deploy run-workflow-automations
```

### 3. Schedule execution (GitHub Actions)

The workflow runs automatically via `.github/workflows/workflow-automations.yml` on weekdays at 8 AM UTC.

**Required:** Set `CRON_SECRET` in repo secrets (same value as for recurring billing).

### 4. Manual trigger

Admins can trigger from **Settings → Workflow Automations → Run now**.

## Configuration

### Rules

| Rule | Config | Description |
|------|--------|-------------|
| `auto_assign_jobs` | `strategy: "site_based" \| "round_robin"` | Assign unassigned jobs to workers |
| `escalate_overdue` | `days_overdue`, `notify_assigned`, `notify_admins` | Escalate jobs past due date |
| `job_due_reminders` | `days_before`, `notify_assigned` | Remind before due date |
| `deal_follow_up_reminders` | `days_without_touch`, `stages` | Remind when deals go stale |

### Edit rules

Update `workflow_automation_rules` in Supabase or via Settings (admins only).

### View logs

**Settings → Workflow Automations** shows recent runs. Full history is in `workflow_automation_log`.

## Prerequisites

- **Jobs** with `assigned_worker_id`, `site_id`, `scheduled_date`, `status`
- **worker_site_assignments** for site-based auto-assign
- **Deals** with `assigned_user_id` or `assigned_to`, `last_touch_at`, `stage`
- **notifications** table for in-app alerts
- Push notifications (optional) for job assignments
