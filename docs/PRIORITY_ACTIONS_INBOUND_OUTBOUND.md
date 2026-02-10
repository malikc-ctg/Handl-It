# Priority Actions: Inbound & Outbound Systems Linkage

Priority Actions is fed by **contacts**, **deals**, and **quotes**. For every inbound and outbound touch (calls, emails, sequences), the right fields must be updated so the feed stays accurate and reps see the right next steps.

---

## 1. What feeds Priority Actions

The tab loads **deals** and **contacts** (and quotes), then `generatePriorityActions()` builds the list from these fields:

### Contacts (contact-based actions)

| Field | Used for |
|-------|-----------|
| `no_contact_streak` | 1 = P2 "Follow up (attempt 2 of 3)"; 2 = P1 "FINAL ATTEMPT" |
| `next_follow_up_date` + `next_follow_up_type` | P1 "Missed follow-up" when date < today |
| `quote_sent_at` | P2 "Day 1/3/7: Quote follow-up" when 1–7 days ago |
| `total_contact_attempts`, `last_contacted_at` | 0 = P3 "New contact"; >0 and idle 7–30 days = P3 "Re-engage" |
| `last_contact_attempt_at` | Sort / "last activity" |

### Deals (deal-based actions)

| Field | Used for |
|-------|-----------|
| `next_action_date` + `next_action_type` | Callback overdue (P1), Walkthrough today (P1) |
| `last_touch_at` | Idle deals (P3 "Re-engage"), sort |
| `no_contact_streak` | P2 "Follow up (attempt 2 of 3)" |
| `quote_sent_at` | P2 "Day 1/3/7: Quote follow-up" |
| `walkthrough_completed_at` | P2 "Send quote after walkthrough" |
| `stage_entered_at` | P3 "Stuck in stage" |
| `total_contact_attempts` | P3 "New deal - make first contact" |

### Quotes

| Field | Used for |
|-------|-----------|
| `expiry_date` | P1 "Quote expiring in Xh" when < 48h |

### Sales activities

- Timeline and "last activity" use `sales_activities` (e.g. `activity_date`, `activity_type`, `outcome`).
- Logging activity (with outcome) can drive contact updates via `log_sales_activity_with_contact_update` (streak, `last_contact_attempt_at`, `last_contacted_at`, `next_follow_up_date`).

---

## 2. Inbound systems → Priority Actions

When something **comes in** (call, email/SMS reply, form), update the following so Priority Actions reflects it.

### 2.1 Inbound / outbound call (Quo)

**When:** Quo webhook `call.completed` (or equivalent) with outcome and optional transcript.

**Do:**

| Entity | Update |
|--------|--------|
| **Deal** (if call linked to site → deal) | `last_touch_at = NOW()`. If outcome is missed/no_answer/voicemail: `next_action_type = 'callback'`, `next_action_date` = tomorrow (or from post-call workflow). If answered: optionally set `last_contacted_at` on deal if column exists. |
| **Contact** (deal’s `primary_contact_id` or resolved from call) | `last_contact_attempt_at = NOW()`. If answered: `last_contacted_at = NOW()`, `no_contact_streak = 0`. If missed/no_answer: `no_contact_streak = LEAST(2, COALESCE(no_contact_streak,0) + 1)`, `next_follow_up_date` = tomorrow, `next_follow_up_type = 'call'`. `total_contact_attempts = COALESCE(total_contact_attempts,0) + 1`. |
| **sales_activities** | Insert row: `deal_id`, `contact_id`, `activity_type = 'call'`, `outcome` = 'contact_made' if answered else 'no_contact', `activity_date` / `created_at`, `next_action_date` / `next_action_type` if set, `company_id`, `assigned_user_id` from deal. |

**Where:** Implemented in **quo-webhook** Edge Function after the call is stored (see code).

### 2.2 Inbound email / SMS reply

**When:** Inbound message received (e.g. Twilio/Quo webhook → `receive-inbound-message`).

**Do:**

| Entity | Update |
|--------|--------|
| **Contact** (from message → contact lookup) | `last_contacted_at = NOW()`, `no_contact_streak = 0` (they replied). |
| **Deal** (if message linked to deal) | `last_touch_at = NOW()`. |
| **sales_activities** | Optional: insert `activity_type = 'email'` or `'text'`, `outcome = 'contact_made'`. |
| **Sequences** | Stop rules: mark enrollment stopped so no more automated emails. |

**Where:** In **receive-inbound-message** (or equivalent): after recording the message, resolve contact/deal and run the updates above.

### 2.3 New lead / new contact (form or import)

**When:** New row in `contacts` or lead table.

**Do:** Keep `total_contact_attempts = 0` and `last_contacted_at` / `last_contact_attempt_at` null so they appear as **P3 "New contact - make first call"** in Priority Actions. Assign `assigned_user_id` so the tab filters to the right rep.

---

## 3. Outbound systems → Priority Actions

When something **goes out** (outbound call, email sent, sequence step sent), update so Priority Actions and “no touch” logic stay correct.

### 3.1 Outbound call (Quo)

Same as inbound: Quo webhook includes direction. Apply the same deal/contact/sales_activity updates so the call shows in timeline and streaks / next actions are correct.

### 3.2 Email / SMS sent (send-message or UI)

**When:** A message is sent (e.g. from **send-message** Edge Function or UI “Send email”).

**Do:**

| Entity | Update |
|--------|--------|
| **Deal** (if message linked to deal/site) | `last_touch_at = NOW()`. |
| **Contact** (recipient) | `last_contact_attempt_at = NOW()` (attempt made). Do **not** set `last_contacted_at` (no reply yet). Optionally increment `total_contact_attempts`. Streak: if you treat “sent” as attempt, increment `no_contact_streak` only when you know they didn’t reply (e.g. next step in sequence); or leave streak unchanged until next call/outcome. |
| **sales_activities** | Optional: insert `activity_type = 'email'`, `outcome = 'email_sent'`, `next_action_date` if “follow up in 3 days”. |

**Where:** In **send-message** after successful send: resolve `deal_id` / `contact_id` from enrollment or message metadata and run the updates (or call a small shared helper).

### 3.3 Sequence step sent

Already handled if **process-sequence-steps** triggers **send-message** and send-message does the deal/contact/sales_activity updates above. Optionally set deal/contact `next_follow_up_date` from the next step’s scheduled time.

### 3.4 Quote sent

**When:** Quote is marked sent (e.g. deal stage → proposal or quote status → sent).

**Do:**

| Entity | Update |
|--------|--------|
| **Deal** | `quote_sent_at = NOW()`. |
| **Contact** (primary for deal) | `quote_sent_at = NOW()` so contact-based “Quote follow-up” appears. |

**Where:** In the app when saving “Quote sent” or when updating deal stage to proposal; or in Zapier if that’s where the event is handled.

### 3.5 Manual “Log activity” (deal or contact)

**When:** Rep logs a call/email/meeting from the deal or Priority Actions “Log” button.

**Do:**

- **Deal:** Ensure `sales_activities` row has `deal_id`, `activity_date`, `activity_type`, `outcome`. Optionally update deal `last_touch_at` and `next_action_date`/`next_action_type` from the form (already partially done in UI).
- **Contact:** Use **log_sales_activity_with_contact_update** (or equivalent) so contact gets `last_contact_attempt_at`, `last_contacted_at`, `no_contact_streak`, `next_follow_up_date` from outcome.

---

## 4. Summary table

| Event | Deal | Contact | sales_activities |
|-------|------|---------|------------------|
| **Call (Quo) answered** | `last_touch_at` | `last_contact_attempt_at`, `last_contacted_at`, `no_contact_streak=0` | Insert call, outcome contact_made |
| **Call (Quo) missed** | `last_touch_at`, `next_action_*` = callback | `last_contact_attempt_at`, `no_contact_streak`+1, `next_follow_up_*` | Insert call, outcome no_contact |
| **Inbound reply** | `last_touch_at` | `last_contacted_at`, `no_contact_streak=0` | Optional insert |
| **Outbound email sent** | `last_touch_at` | `last_contact_attempt_at` (optional streak) | Optional insert |
| **Quote sent** | `quote_sent_at` | `quote_sent_at` (primary contact) | Optional |
| **Log activity (UI)** | `last_touch_at` / `next_action_*` from form | Via log_sales_activity_with_contact_update | Insert |

---

## 5. Implementation status

- **Quo webhook → deal + contact + sales_activity:** Implemented in **quo-webhook** (see `supabase/functions/quo-webhook/index.ts`). On call completed: updates deal `last_touch_at` and (if missed) `next_action_type`/`next_action_date`; updates primary contact streak and follow-up; inserts `sales_activities` row.
- **receive-inbound-message:** Documented above; add contact/deal updates when reply is recorded.
- **send-message:** Documented above; add deal/contact/sales_activity updates after successful send when deal/contact are known.
- **Quote sent:** Best done in app when saving quote status or deal stage; or in Zapier if that’s the source of truth.

With these linkages, inbound and outbound systems keep Priority Actions in sync so reps see accurate callbacks, follow-ups, and idle/new items.
