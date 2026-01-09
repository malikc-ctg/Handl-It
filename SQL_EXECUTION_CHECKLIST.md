# 📋 SQL Execution Checklist - Complete Order

## ⚠️ IMPORTANT: Run these SQL files in this EXACT order!

All SQL files must be run in Supabase SQL Editor, one at a time, in the order listed below.

---

## 🔴 Phase 1: Core Sales CRM (MUST RUN FIRST)

### 1. CORE_SALES_CRM_SCHEMA.sql
- **Purpose:** Creates all core sales CRM tables, enums, indexes, and triggers
- **Creates:** Leads, Contacts, Deals, Quotes, Calls, Messages, Tasks, Sequences, Routes, Territories, Doors, Events tables
- **Status:** ⏳ NOT RUN
- **Time:** ~2-3 minutes

### 2. CORE_SALES_CRM_RLS_AND_CONSTRAINTS.sql
- **Purpose:** Enables Row Level Security and creates policies for workspace isolation
- **Requires:** CORE_SALES_CRM_SCHEMA.sql to be run first
- **Status:** ⏳ NOT RUN
- **Time:** ~1-2 minutes

### 3. CORE_SALES_CRM_SEED_DATA.sql
- **Purpose:** Seeds default deal stages, creates helper functions and views
- **Requires:** CORE_SALES_CRM_SCHEMA.sql and CORE_SALES_CRM_RLS_AND_CONSTRAINTS.sql
- **Status:** ⏳ NOT RUN
- **Time:** ~1 minute

### 4. CORE_SALES_CRM_TESTS.sql (OPTIONAL)
- **Purpose:** Unit tests for constraints and critical queries
- **Requires:** All Phase 1 files above
- **Status:** ⏳ NOT RUN
- **Time:** ~30 seconds

---

## 🟠 Phase 2: Sales Portal Schema

### 5. ADD_SALES_PORTAL_SCHEMA.sql
- **Purpose:** Additional sales portal tables (quote templates, line items, etc.)
- **Requires:** Phase 1 complete
- **Status:** ⏳ NOT RUN
- **Time:** ~1-2 minutes

### 6. ADD_REP_ROLE_SUPPORT.sql
- **Purpose:** Adds 'rep' role for sales representatives
- **Requires:** Phase 1 complete
- **Status:** ⏳ NOT RUN
- **Time:** ~30 seconds

---

## 🟡 Phase 3: Security & Audit

### 7. ADD_RBAC_AUDIT_LOGGING.sql
- **Purpose:** Audit logging and RBAC enhancements for sales activities
- **Requires:** Phase 1 and 2 complete
- **Status:** ⏳ NOT RUN
- **Time:** ~1-2 minutes

---

## 🟢 Phase 4: Billing & Subscriptions

### 8. ADD_RECURRING_BILLING_CRON.sql
- **Purpose:** Automated subscription billing with cron jobs
- **Requires:** Phase 1 complete
- **Status:** ⏳ NOT RUN
- **Time:** ~2-3 minutes
- **Note:** Enables pg_cron extension

---

## 🔵 Phase 5: Quo Integration

### 9. ADD_QUO_CALLS_SCHEMA.sql
- **Purpose:** Quo integration for call tracking and recording
- **Requires:** ADD_SALES_PORTAL_SCHEMA.sql (for deals/contacts)
- **Status:** ⏳ NOT RUN
- **Time:** ~1-2 minutes

### 10. ADD_QUO_POST_CALL_TRIGGER.sql
- **Purpose:** Post-call automation triggers
- **Requires:** ADD_QUO_CALLS_SCHEMA.sql
- **Status:** ⏳ NOT RUN
- **Time:** ~30 seconds

---

## 🟣 Phase 6: Route Management

### 11. ADD_ROUTE_MANAGEMENT_SCHEMA.sql
- **Purpose:** Door-to-door route and territory management
- **Requires:** Phase 1 complete
- **Status:** ⏳ NOT RUN
- **Time:** ~2-3 minutes

---

## ⚪ Phase 7: Analytics

### 12. ADD_ANALYTICS_SCHEMA.sql
- **Purpose:** Sales analytics tables and performance tracking
- **Requires:** Phase 1 and 2 complete
- **Status:** ⏳ NOT RUN
- **Time:** ~1-2 minutes

### 13. ADD_ANALYTICS_FUNCTIONS.sql
- **Purpose:** Analytics helper functions and reporting queries
- **Requires:** ADD_ANALYTICS_SCHEMA.sql
- **Status:** ⏳ NOT RUN
- **Time:** ~1 minute

---

## 📊 Summary

**Total SQL Files to Run:** 13 files (12 required + 1 optional test file)

**Total Estimated Time:** ~15-20 minutes

**Dependencies:**
- Phase 1 must be run first (foundation)
- Phase 2 depends on Phase 1
- Phase 3-7 can mostly run after Phase 1, but some have specific dependencies noted above

---

## ✅ Execution Checklist

Copy this checklist and check off each file as you run it:

### Phase 1: Core Sales CRM
- [ ] 1. CORE_SALES_CRM_SCHEMA.sql
- [ ] 2. CORE_SALES_CRM_RLS_AND_CONSTRAINTS.sql
- [ ] 3. CORE_SALES_CRM_SEED_DATA.sql
- [ ] 4. CORE_SALES_CRM_TESTS.sql (optional)

### Phase 2: Sales Portal
- [ ] 5. ADD_SALES_PORTAL_SCHEMA.sql
- [ ] 6. ADD_REP_ROLE_SUPPORT.sql

### Phase 3: Security & Audit
- [ ] 7. ADD_RBAC_AUDIT_LOGGING.sql

### Phase 4: Billing
- [ ] 8. ADD_RECURRING_BILLING_CRON.sql

### Phase 5: Quo Integration
- [ ] 9. ADD_QUO_CALLS_SCHEMA.sql
- [ ] 10. ADD_QUO_POST_CALL_TRIGGER.sql

### Phase 6: Routes
- [ ] 11. ADD_ROUTE_MANAGEMENT_SCHEMA.sql

### Phase 7: Analytics
- [ ] 12. ADD_ANALYTICS_SCHEMA.sql
- [ ] 13. ADD_ANALYTICS_FUNCTIONS.sql

---

## 🚨 Troubleshooting

### If a SQL file fails:
1. **Check dependencies:** Make sure all required previous files have been run
2. **Check for existing tables:** Some files use `CREATE TABLE IF NOT EXISTS` which is safe
3. **Check for errors:** Look at the specific error message in Supabase SQL Editor
4. **Skip optional files:** The test file (CORE_SALES_CRM_TESTS.sql) can be skipped

### Common Issues:
- **"relation already exists"** - This is usually safe to ignore (table already created)
- **"type already exists"** - ENUM types already created, safe to ignore
- **"permission denied"** - May need to run as postgres user or check RLS policies
- **"extension not available"** - For pg_cron, may need to enable in Supabase dashboard first

---

## 📝 Notes

- Run each file **one at a time** in Supabase SQL Editor
- Wait for each file to complete before running the next
- Save this checklist and mark off each file as you complete it
- If you encounter errors, note them and continue with the gameplan implementation

---

**Ready to execute when you say "run it fam"!** 🚀
