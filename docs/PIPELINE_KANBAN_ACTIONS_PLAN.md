# Pipeline Kanban: Plus (+) and Three-Dots (⋮) Actions Plan

## Current state
- **Closed Lost**: No plus. Three-dots only → "Clear pipeline" (delete all deals in stage). ✅ Done.
- **Qualification, Proposal, Negotiation, Closed Won**: Plus and three-dots are present but not wired to actions.

---

## Proposed behavior

### Plus (+)

| Stage           | Show +? | Action |
|----------------|---------|--------|
| **Qualification** | Yes     | **New deal** – Open create-deal modal with stage pre-set to Qualification (same as main "New Deal" but scoped to this column). |
| **Proposal**      | Yes     | **New deal** – Open create-deal modal with stage pre-set to Proposal. |
| **Negotiation**   | Yes     | **New deal** – Open create-deal modal with stage pre-set to Negotiation. |
| **Closed Won**    | No      | Remove + (you don’t “add” a won deal from the board; deals move here when won). |
| **Closed Lost**   | No      | Already removed. ✅ |

### Three-dots (⋮)

| Stage           | Clickable? | Menu options |
|----------------|-----------|--------------|
| **Qualification** | Optional* | • **Export deals** – Export this column’s deals (e.g. CSV).<br>• **View in list** – Switch to list/table view filtered to this stage. |
| **Proposal**      | Optional* | Same as Qualification. |
| **Negotiation**   | Optional* | Same as Qualification. |
| **Closed Won**    | Yes       | • **Clear pipeline** – Permanently delete all deals in Closed Won (with confirm).<br>• **Export deals** – Export won deals. |
| **Closed Lost**   | Yes       | • **Clear pipeline** only. ✅ Done. |

\*Optional = can leave three-dots as visual-only for now and add these later, or implement when you’re ready.

---

## Summary

1. **Plus**
   - Qualification, Proposal, Negotiation: **New deal** (create-deal modal, stage = that column).
   - Closed Won: **Remove** (no +).
   - Closed Lost: **Already removed.**

2. **Three-dots**
   - **Closed Lost**: Only stage with a required action today → **Clear pipeline** (done).
   - **Closed Won**: Add menu → **Clear pipeline** + **Export deals** (recommended).
   - **Qualification / Proposal / Negotiation**: Either leave as placeholder or add **Export** and/or **View in list** when you want them.

---

## Implementation order (suggested)

1. **Closed Won**
   - Remove the + button (match Closed Lost).
   - Wire three-dots: dropdown with “Clear pipeline” (and optionally “Export deals”).
2. **Qualification, Proposal, Negotiation**
   - Wire + to open create-deal modal with `stage` = that column’s stage.
   - Optionally wire three-dots later (Export / View in list).

If you want to keep the UI minimal, we can:
- Only implement **Closed Won**: remove + and add three-dots “Clear pipeline” (and optionally “Export”).
- Leave the other three-dots as non-clickable until you’re ready for Export/View in list.

Tell me which of these you want (e.g. “do Closed Won like Lost” or “do plus = new deal and three-dots for Closed Won only”) and I’ll implement that next.
