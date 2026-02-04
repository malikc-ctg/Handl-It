# Priority Actions: Mini Powerhouse CRM — Update Plan

## Current state (summary)

- **Dashboard widget:** Top 3 priority actions from **contacts** (no-contact streak, missed follow-up, quote follow-up, new, idle) and **deals** (quote expiring, missed callback, walkthrough today). Each card: name, reason, last activity, **Log** + **Call** (contact) or **Log** + **View** (deal).
- **Full Priority tab:** Contact-only list (same P1/P2/P3 logic). Cards show name, company, reason, last activity, phone/email, **Log Activity** + **Call Now**. Deal-based actions (quote expiring, missed callback, walkthrough) are **not** shown on the full page.
- **Log activity:** `openLogActivityForContact(contactId)` opens the shared log-activity modal; deal-based actions use deal id and a different flow. Contact logging updates `contact_attempts` (or similar) and can set next follow-up.

---

## Vision: Priority Actions as a “mini powerhouse CRM”

One place to **see what to do next**, **act fast** (call, email, log, send template), and **stay in context** (deal, value, last note) without leaving the list.

---

## Phase 1: Unified feed + deal context (foundation)

| # | Item | Description |
|---|------|-------------|
| 1.1 | **Merge deal-based actions on full page** | Full Priority tab currently uses only contacts. Use the same `generatePriorityActions(deals, quotes, contacts)` (or equivalent) so the full page shows **quote expiring**, **missed callback**, **walkthrough today**, etc., with correct P1/P2/P3. |
| 1.2 | **Link contact → deal where possible** | When loading priority actions, for each contact resolve linked deal(s) (e.g. by `primary_contact_id` on deals, or contact→account→deals). Attach `dealId`, `dealStage`, `dealValue` to the action so the UI can show and link to the deal. |
| 1.3 | **Richer action cards** | Each card shows: **Deal** (if any): stage badge, value, “Open deal” link. **Contact**: name, company, reason, last activity. **One-line context**: e.g. “Last note: …” or “Next: Call back 2/5” when available. |

**Outcome:** One prioritized list (contacts + deals), with deal context and “Open deal” on every action that has a deal.

---

## Phase 2: One-click actions (powerhouse bar)

| # | Item | Description |
|---|------|-------------|
| 2.1 | **Action bar on every card** | Same set of buttons for every card (hide disabled when no phone/email/deal): **Call** (tel:), **Email** (mailto: or open compose), **Text** (sms: or open compose), **Log**, **Open deal** (if linked). |
| 2.2 | **“Send follow-up” / “Send proposal”** | Add **Email** (or “Follow-up”) and **Proposal** buttons that open the **compose modal** (same as deal detail) with **To** and **Use template** pre-filled from contact/deal. Reuse sales templates + merge fields; if action has a deal, use deal context for merge. |
| 2.3 | **Quick log from card** | Option A: Keep “Log” opening the full log-activity modal. Option B: Add an optional **quick log** (e.g. “Contacted” / “No answer” + set next follow-up date) in a small inline or slide-over so reps can clear the action in one click when appropriate. |

**Outcome:** From one screen, reps can call, email, send a template, or log without opening multiple pages.

---

## Phase 3: Filters, sort, and “today’s focus”

| # | Item | Description |
|---|------|-------------|
| 3.1 | **Filters** | Filter by: **Priority** (P1 / P2 / P3), **Type** (e.g. Final attempt, Quote follow-up, New contact, Idle, Quote expiring, Missed callback, Walkthrough), **Has deal** (yes/no). Optional: **Date range** (e.g. overdue since). |
| 3.2 | **Sort** | Sort by: **Priority** (P1 first, then P2, P3), **Last activity** (oldest first), **Deal value** (highest first), **Next follow-up date**. |
| 3.3 | **“Today’s focus” (optional)** | Section at top: “Today’s top 5” or “Focus list” — e.g. P1s first, then P2 quote follow-ups, then by value. Or a “Star” / “Focus” flag per action so users can build a personal daily list. |

**Outcome:** Reps can narrow to what matters (e.g. “P1 only” or “quote follow-ups”) and sort by value or urgency.

---

## Phase 4: Quick log and next step

| # | Item | Description |
|---|------|-------------|
| 4.1 | **Quick outcome** | From the card or after “Log”, capture: **Outcome** (Contact made / No answer / Voicemail / Callback scheduled, etc.) and **Next step** (Next follow-up date + type: Call / Email / Meeting). Persist to the same place the current log-activity modal writes to (contact attempt, deal activity, etc.). |
| 4.2 | **Snooze / schedule** | “Schedule next” from the card: set **Next follow-up date** and **Type** (Call, Email, etc.) so the contact/deal reappears in Priority Actions on that day. |

**Outcome:** Fewer clicks to mark “done” or “scheduled” and keep the list accurate.

---

## Phase 5: Polish and scale

| # | Item | Description |
|---|------|-------------|
| 5.1 | **Bulk actions (optional)** | Select multiple cards (e.g. checkboxes): **Mark as contacted**, **Schedule same follow-up**, or **Export list**. |
| 5.2 | **Dashboard widget = same logic** | Ensure the dashboard “Top 3” uses the same unified list and same card actions (Log, Call, and optionally Email / Open deal) so behavior is consistent. |
| 5.3 | **Empty states and refresh** | Clear empty state: “All caught up” with optional CTA (e.g. “View all contacts” or “Create deal”). Keep **Refresh** and consider auto-refresh when returning to the tab. |
| 5.4 | **Mobile** | Ensure action bar (Call, Email, Log, Open deal) is usable on small screens (stack or scroll horizontally). |

**Outcome:** Consistent experience between widget and full page, and room for power users (bulk, export).

---

## Implementation order (recommended)

1. **Phase 1** — Unified feed + deal context (merge deal actions on full page, link contact→deal, richer cards). Required for everything else.
2. **Phase 2** — One-click actions (action bar, Send follow-up / Proposal from templates, quick log optional).
3. **Phase 3** — Filters and sort (priority, type, has deal; sort by priority, value, date).
4. **Phase 4** — Quick log and “schedule next” from the card.
5. **Phase 5** — Polish (dashboard alignment, empty states, mobile, optional bulk).

---

## Data / API notes

- **Contacts:** `loadContactsForPriorityActions()` — ensure it returns fields needed for linking to deals (e.g. id, account/site if applicable).
- **Deals:** `loadDealsForDashboard()` (or same source) for quote expiring, missed callback, walkthrough; attach `primary_contact_id` / contact info where available.
- **Templates:** Reuse existing compose modal + sales templates + `buildMergeContext(deal)`; for contact-only actions, build a minimal context from contact + optional linked deal.
- **Log activity:** Reuse `openLogActivityForContact(contactId)` and deal-based log flow; optional quick-log can call the same backend with a reduced set of fields (outcome + next date/type).

---

## Success criteria (mini powerhouse)

- **One list** for “what to do next” (contacts + deals).
- **One place** to Call, Email, Send template, Log, and Open deal.
- **Context at a glance** (deal stage, value, last activity, next step).
- **Fewer clicks** to log outcome and schedule next follow-up.
- **Filters/sort** so reps can focus (e.g. P1 only, or by deal value).

This plan turns Priority Actions into a focused “daily command center” without replacing the full Deals or Contacts tabs.
