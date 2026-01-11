# 📋 Remaining SQL Files to Run

## ✅ Already Fixed/Ready:
- ✅ CORE_SALES_CRM_SCHEMA.sql (Fixed - ready to run)
- ✅ CORE_SALES_CRM_SEED_DATA.sql (Fixed - ready to run)
- ✅ ADD_SALES_PORTAL_SCHEMA.sql (Fixed - ready to run)
- ✅ ADD_REP_ROLE_SUPPORT.sql (Fixed - ready to run)

---

## 📋 Remaining SQL Files (In Order)

### **Phase 1: Core Sales CRM (Continue from here)**

#### ✅ 1. CORE_SALES_CRM_SCHEMA.sql
- **Status:** Fixed and ready
- **What it does:** Creates all core sales CRM tables
- **Run if:** You haven't run it yet or it failed before

#### 2. CORE_SALES_CRM_RLS_AND_CONSTRAINTS.sql ⏳
- **Status:** NOT RUN
- **Purpose:** Enables Row Level Security and creates policies
- **Requires:** CORE_SALES_CRM_SCHEMA.sql
- **Time:** ~1-2 minutes

#### ✅ 3. CORE_SALES_CRM_SEED_DATA.sql
- **Status:** Fixed and ready
- **What it does:** Seeds default deal stages, creates helper functions
- **Run if:** You haven't run it yet or it failed before

#### 4. CORE_SALES_CRM_TESTS.sql (OPTIONAL)
- **Status:** NOT RUN
- **Purpose:** Unit tests
- **Time:** ~30 seconds
- **Note:** Can skip if you want

---

### **Phase 2: Sales Portal (Continue from here)**

#### ✅ 5. ADD_SALES_PORTAL_SCHEMA.sql
- **Status:** Fixed and ready
- **Run if:** You haven't run it yet or it failed before

#### ✅ 6. ADD_REP_ROLE_SUPPORT.sql
- **Status:** Fixed and ready
- **Run if:** You haven't run it yet or it failed before

---

### **Phase 3: Security & Audit**

#### 7. ADD_RBAC_AUDIT_LOGGING.sql ⏳
- **Status:** NOT RUN
- **Purpose:** Audit logging and RBAC enhancements
- **Requires:** Phase 1 and 2 complete
- **Time:** ~1-2 minutes

---

### **Phase 4: Billing & Subscriptions**

#### 8. ADD_RECURRING_BILLING_CRON.sql ⏳
- **Status:** NOT RUN
- **Purpose:** Automated subscription billing with cron jobs
- **Requires:** Phase 1 complete
- **Time:** ~2-3 minutes
- **Note:** Enables pg_cron extension (may need to enable in Supabase dashboard first)

---

### **Phase 5: Quo Integration**

#### 9. ADD_QUO_CALLS_SCHEMA.sql ⏳
- **Status:** NOT RUN
- **Purpose:** Quo integration for call tracking
- **Requires:** ADD_SALES_PORTAL_SCHEMA.sql
- **Time:** ~1-2 minutes

#### 10. ADD_QUO_POST_CALL_TRIGGER.sql ⏳
- **Status:** NOT RUN
- **Purpose:** Post-call automation triggers
- **Requires:** ADD_QUO_CALLS_SCHEMA.sql
- **Time:** ~30 seconds

---

### **Phase 6: Route Management**

#### 11. ADD_ROUTE_MANAGEMENT_SCHEMA.sql ⏳
- **Status:** NOT RUN
- **Purpose:** Door-to-door route and territory management
- **Requires:** Phase 1 complete
- **Time:** ~2-3 minutes

---

### **Phase 7: Analytics**

#### 12. ADD_ANALYTICS_SCHEMA.sql ⏳
- **Status:** NOT RUN
- **Purpose:** Sales analytics tables
- **Requires:** Phase 1 and 2 complete
- **Time:** ~1-2 minutes

#### 13. ADD_ANALYTICS_FUNCTIONS.sql ⏳
- **Status:** NOT RUN
- **Purpose:** Analytics helper functions
- **Requires:** ADD_ANALYTICS_SCHEMA.sql
- **Time:** ~1 minute

---

## 🎯 Quick Summary

**Still need to run:**
1. ✅ CORE_SALES_CRM_SCHEMA.sql (if not run yet)
2. ⏳ CORE_SALES_CRM_RLS_AND_CONSTRAINTS.sql
3. ✅ CORE_SALES_CRM_SEED_DATA.sql (if not run yet)
4. ⏳ CORE_SALES_CRM_TESTS.sql (optional - can skip)
5. ✅ ADD_SALES_PORTAL_SCHEMA.sql (if not run yet)
6. ✅ ADD_REP_ROLE_SUPPORT.sql (if not run yet)
7. ⏳ ADD_RBAC_AUDIT_LOGGING.sql
8. ⏳ ADD_RECURRING_BILLING_CRON.sql
9. ⏳ ADD_QUO_CALLS_SCHEMA.sql
10. ⏳ ADD_QUO_POST_CALL_TRIGGER.sql
11. ⏳ ADD_ROUTE_MANAGEMENT_SCHEMA.sql
12. ⏳ ADD_ANALYTICS_SCHEMA.sql
13. ⏳ ADD_ANALYTICS_FUNCTIONS.sql

**Total remaining:** 7-8 files (depending on which ones you've already run)

---

## ⚠️ Important Notes

- Run files **in order** as listed above
- Wait for each file to complete before running the next
- All the ✅ files have been fixed and should work now
- The ⏳ files haven't been run yet (we'll fix them if they have issues)

---

**Ready to continue!** 🚀
