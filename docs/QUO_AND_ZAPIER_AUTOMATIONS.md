# Best Automations: Quo + Zapier + NFG

Recommendations for high-impact automations using **Quo** (call tracking), your **NFG app** (Supabase, deals, contacts, priority actions), and **Zapier**.

---

## Part 1: Automations Within Quo + NFG (No Zapier)

These use your existing Quo webhook → NFG flow and internal workflow.

### 1. **Post-call → activity and next action (already in place)**

- **Quo:** `call.completed` + transcript → your `quo-webhook` → `calls` table.
- **NFG:** `quo-post-call-workflow` (or DB trigger) runs on new transcript → summary, objection tags, next action.
- **Enhancement:** Have the post-call workflow **write to `sales_activities`** with `activity_type: 'call'`, `outcome`, `next_action_date` / `next_action_type`, and `deal_id` (from call → site → deal). That way the call shows in deal timeline and feeds **Priority Actions** (e.g. “Callback due”).

### 2. **Call completed → update deal/site last touch**

- In **quo-webhook** (or a small DB trigger): when a call is linked to a `site_id`, update the related **deal** (if any) with `last_touch_at = NOW()` and optionally `last_contacted_at`. So your “no touch” and “idle deal” logic stays accurate without manual logging.

### 3. **Missed call → create priority action or notification**

- On **call.completed** with outcome = `no_answer` / `missed`: create a **notification** for the assigned user and/or insert a **sales_activity** with `next_action_type: 'callback'` and `next_action_date` = today + 1 so it appears in **Priority Actions** as “Callback due”.

### 4. **Quo contact ↔ NFG contact/deal mapping**

- Keep **quo_contact_mappings** (Quo contact ID → `site_id`) up to date. Optionally: when a new **deal** or **contact** is created in NFG with a phone number, call Quo API (if available) to create/link the contact and store the mapping so future calls auto-link.

---

## Part 2: Zapier Automations (Quo + NFG + more)

Use Zapier to connect **Quo** and **NFG (Supabase)** to email, Slack, spreadsheets, etc.

### 1. **New completed call (Quo) → log to NFG + notify**

- **Trigger:** Zapier “Webhooks by Zapier” or **Quo** (if they have a Zapier app) on “Call completed”.
- **Actions:**
  - **Supabase:** Insert into `calls` or `sales_activities` (if you prefer Zapier to be the writer instead of Quo webhook).
  - **Slack / Email:** “New call with [Contact] – [duration]. Summary: …” so the team sees it without opening the app.

### 2. **New deal in NFG → create/link in Quo**

- **Trigger:** Zapier “Supabase – New Row” on `deals` (or “Updated Row” when `stage` changes to qualification).
- **Action:** Quo (if API exists) or **Webhooks** to create/update a contact and store `metadata.deal_id` / `metadata.site_id` so when the rep calls from Quo, the call links back to the deal.

### 3. **Priority action / missed callback → Zapier**

- **Trigger:** Supabase “New Row” on a table you use for “priority actions” or “tasks” (e.g. a `priority_actions_queue` table that your app or a cron fills), or “New Row” on `sales_activities` where `next_action_type = 'callback'`.
- **Actions:**
  - **Slack:** “Reminder: Call back [Contact] for [Deal].”
  - **Gmail / SendGrid:** Send a reminder email to the rep.
  - **Quo:** If Quo has “create task” or “reminder” via API, create a follow-up task there.

### 4. **Quote sent / deal stage change → email or Slack**

- **Trigger:** Supabase “Updated Row” on `deals` where `stage` = `proposal` or “New Row” on `quotes` where `status` = `sent`.
- **Actions:**
  - **Slack:** “Quote sent for [Deal] – $X. Follow up in 3 days.”
  - **Email:** Same to the deal owner or sales channel.

### 5. **New lead / new contact → Quo + NFG**

- **Trigger:** “New Row” on `contacts` or `leads` (or form submission via Zapier Forms).
- **Actions:**
  - **Supabase:** Ensure contact/lead exists in NFG (if not already).
  - **Quo:** Create contact in Quo with phone so click-to-call works.
  - **Slack / Email:** “New lead: [Name] – [Company]. Assigned to [Rep].”

### 6. **Call with objections (from post-call) → Slack / CRM note**

- **Trigger:** Supabase “New Row” or “Updated Row” on `calls` where `summary` or an `objection_tags` column contains “price” / “competitor” / etc. (You’d need to store post-call output in `calls` or `sales_activities`.)
- **Actions:**
  - **Slack:** “Call with [Contact]: objections = price, competitor. Suggested next step: send comparison doc.”
  - **Supabase:** Append to a “CRM notes” or `sales_activities.notes` for that deal.

---

## Part 3: How to Wire Zapier to NFG (Supabase)

- **Triggers:** Use **Zapier’s Supabase integration** (“New Row”, “Updated Row”) on tables like `deals`, `quotes`, `calls`, `sales_activities`, `contacts`. Filter by column values (e.g. `stage`, `outcome`) to get only the events you want.
- **Actions:** Use **Supabase** action in Zapier to “Create Row” or “Update Row” (e.g. insert into `sales_activities`, update `deals.last_touch_at`). Use a **Supabase service role** or a dedicated **API key** with minimal scope; store it in Zapier as a secret.
- **Webhooks:** Your **quo-webhook** and other Edge Functions already receive Quo. For Zapier → NFG you can also expose a small **Supabase Edge Function** that Zapier calls via “Webhooks by Zapier” (POST) to create/update records, if you need custom logic.

---

## Quick wins (do first)

1. **Within Quo/NFG:** Post-call workflow writing to `sales_activities` and updating deal `last_touch_at` so Priority Actions and “no touch” reminders are accurate.
2. **Zapier:** “New completed call” or “New deal” → Slack/email so the team gets instant visibility.
3. **Zapier:** “Deal stage = proposal” or “Quote sent” → reminder (Slack/email) to follow up in 3 days.

Then add: missed-call → notification, objection tags → Slack, and Quo contact creation from new NFG deals/contacts when their APIs support it.

---

## Part 4: Follow-up systems (in-app + Quo + Zapier)

What you have today and the best follow-up automations to add.

### What you already have

| System | What it does | Tables / cron |
|--------|----------------|----------------|
| **Messaging sequences** | Template-based email/SMS follow-ups; enroll a site/deal → steps send on a schedule; stop on reply. | `sequences`, `sequence_steps`, `sequence_enrollments`, `messages_outbound`; **process-sequence-steps** cron + **send-message** |
| **Deal sequences** | Stage-triggered sequences (e.g. “Proposal sent”); steps = email, call, message, task. | `follow_up_sequences`, `sequence_steps`, `sequence_executions`; **sequence-service.js** (email/call/task are TODO; only message writes to `deal_messages`) |
| **Workflow reminders** | In-app + push: no-touch deal, callback due, walkthrough today, quote expiring. | **run-workflow-automations** cron; `workflow_automation_rules`, `deals.next_action_date` / `next_action_type` |
| **Priority Actions** | Feed of contacts/deals with “Callback due”, “Follow-up”, etc., so reps know what to do next. | Fed by `sales_activities`, `deals.next_action_*`, deal cycle automations |

### Best follow-up automations to add

#### 1. **Auto-enroll in a sequence when a quote is sent**

- **When:** Deal moves to `proposal` or a quote is marked `sent`.
- **Do:** Enroll the deal/site in a **messaging sequence** like “Follow up after quote” (e.g. Day 1: “Thanks for your time”; Day 3: “Quick check-in”; Day 7: “Any questions?”).
- **Where:** In the app when saving quote status, or in **Zapier**: trigger on “New/Updated Row” on `quotes` or `deals` → call an Edge Function or Supabase insert into `sequence_enrollments` (if you expose an “enroll” endpoint) or use a small Edge Function that Zapier invokes.

#### 2. **Post-call → schedule next touch (and optionally enroll)**

- **When:** Quo `call.completed` → your **quo-post-call-workflow** (or webhook) has “next action” (e.g. “Send proposal”, “Callback Friday”).
- **Do:**  
  - Set **deals.next_action_date** and **next_action_type** (already recommended in Part 1).  
  - Optionally: if the suggested next action is “Send follow-up email”, **enroll** the site in a short **messaging sequence** (e.g. one email in 24h) so the rep gets a reminder and the system can send the email step.
- **Where:** In **quo-webhook** or **quo-post-call-workflow**: after writing summary/objections, update the deal and, if you have a “follow-up email” sequence, create a `sequence_enrollment` for the site/deal.

#### 3. **New deal / lead → nurture sequence**

- **When:** New row in `deals` (or `contacts` / leads table) in early stage (e.g. `qualification`).
- **Do:** Auto-enroll in a **“New lead nurture”** sequence (e.g. Day 0: intro email; Day 2: case study; Day 5: “Can we schedule a call?”).
- **Where:** DB trigger on `deals` insert, or **Zapier** “New Row” on `deals` → invoke an enroll API or insert into `sequence_enrollments` (with recipient from deal/contact).

#### 4. **No-touch deal → re-engagement sequence**

- **When:** **run-workflow-automations** already sends a “no touch” reminder; you can go one step further.
- **Do:** After N days with no touch, **enroll** the deal/site in a **“Re-engage”** sequence (e.g. “We haven’t connected in a while…”) instead of (or in addition to) only sending the in-app reminder.
- **Where:** In **run-workflow-automations**: when sending a deal_follow_up_reminder, also call your enroll logic (or insert into `sequence_enrollments`) for that deal’s site. Requires site/deal → recipient email/phone from your schema.

#### 5. **Callback / walkthrough due → one-off reminder email (Zapier)**

- **When:** A **sales_activity** or deal has `next_action_type = 'callback'` or `'walkthrough'` and `next_action_date` = today (or you create a “reminder” row).
- **Do:** Send a **one-off reminder email** to the rep (e.g. “Callback due: [Contact] – [Deal]”) so they see it in their inbox.
- **Where:** **Zapier**: trigger on “New Row” or “Updated Row” (e.g. `sales_activities` or a small `follow_up_reminders` table) filtered by type and date → Gmail/SendGrid “Send Email” to the assigned user.

#### 6. **Stop sequences when deal is won or lost**

- **When:** Deal `stage` changes to `won` or `lost`.
- **Do:** Mark all **sequence_enrollments** (and optionally **sequence_executions**) for that deal/site as **stopped** so you don’t email after close.
- **Where:** DB trigger on `deals` update, or in the app when updating stage; call your existing “stop enrollment” / “stop execution” logic (e.g. in **messaging-sequences.js** and **sequence-service.js**).

### Tying Quo and Zapier into follow-ups

- **Quo:** Use post-call “next action” to set **next_action_date** / **next_action_type** and, when it’s “send email”, enroll in a short sequence. That keeps follow-ups aligned with what was agreed on the call.
- **Zapier:** Use Supabase triggers (new/updated deal, quote sent, new `sales_activities`) to:  
  - Enroll in sequences (via an Edge Function or Supabase insert if you model it), or  
  - Send reminder emails/Slack messages to reps.  
  So follow-up *reminders* (to the rep) and *sequences* (to the customer) can both be driven from the same events.
