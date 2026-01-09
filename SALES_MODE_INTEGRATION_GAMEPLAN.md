# 🎯 Sales Mode Integration Gameplan

## Overview
Add a "Sales Mode" toggle button to all new features created by agents 1-11 plus debug agent, making all sales-related features accessible across the application.

---

## 📋 SQL Files to Run (In Order)

### **Phase 1: Core Sales CRM Schema** (MUST RUN FIRST)
1. **CORE_SALES_CRM_SCHEMA.sql**
   - Creates all core sales tables (leads, contacts, deals, quotes, calls, messages, tasks, sequences, routes, territories, doors, events)
   - Creates ENUM types
   - Creates indexes and triggers
   - **Status:** ⏳ Not Run

2. **CORE_SALES_CRM_RLS_AND_CONSTRAINTS.sql**
   - Enables Row Level Security on all sales tables
   - Creates RLS policies for workspace isolation
   - Adds foreign key constraints
   - **Status:** ⏳ Not Run

3. **CORE_SALES_CRM_SEED_DATA.sql**
   - Seeds default deal stages
   - Creates helper functions
   - Creates useful views
   - **Status:** ⏳ Not Run

4. **CORE_SALES_CRM_TESTS.sql** (Optional)
   - Unit tests for constraints and queries
   - **Status:** ⏳ Not Run

### **Phase 2: Supporting Sales Features**
5. **ADD_SALES_PORTAL_SCHEMA.sql**
   - Additional sales portal tables
   - Quote templates and line items
   - **Status:** ⏳ Not Run

6. **ADD_REP_ROLE_SUPPORT.sql**
   - Adds 'rep' role for sales representatives
   - Updates user profiles with rep permissions
   - **Status:** ⏳ Not Run

7. **ADD_RBAC_AUDIT_LOGGING.sql**
   - Audit logging for sales activities
   - Role-based access control enhancements
   - **Status:** ⏳ Not Run

### **Phase 3: Billing & Recurring**
8. **ADD_RECURRING_BILLING_CRON.sql**
   - Automated subscription billing
   - Cron jobs for recurring charges
   - Payment failure handling
   - **Status:** ⏳ Not Run

### **Phase 4: Additional Features**
9. **ADD_QUO_CALLS_SCHEMA.sql**
   - Quo integration for calls
   - Call tracking and recording
   - **Status:** ⏳ Not Run

10. **ADD_QUO_POST_CALL_TRIGGER.sql**
    - Post-call automation triggers
    - **Status:** ⏳ Not Run

11. **ADD_ROUTE_MANAGEMENT_SCHEMA.sql**
    - Door-to-door route management
    - Territory management
    - **Status:** ⏳ Not Run

12. **ADD_ANALYTICS_SCHEMA.sql**
    - Sales analytics tables
    - Performance tracking
    - **Status:** ⏳ Not Run

13. **ADD_ANALYTICS_FUNCTIONS.sql**
    - Analytics helper functions
    - Reporting queries
    - **Status:** ⏳ Not Run

---

## 🎨 Sales Mode Button Implementation

### **What is Sales Mode?**
Sales Mode is a toggle that enables/disables sales-specific features and views throughout the application. When enabled:
- Shows sales-related metrics and widgets
- Adds sales context to existing features (jobs, bookings, sites)
- Enables deal/quote creation from other pages
- Shows sales pipeline views in relevant sections
- Adds "Create Deal" buttons to appropriate places

### **Where to Add Sales Mode Toggle:**

#### **1. Dashboard (dashboard.html)**
- Add toggle button in topbar (next to dark mode toggle)
- When enabled:
  - Show "Sales Pipeline" widget in Overview
  - Add "Quick Deal" button
  - Show sales metrics in summary cards
  - Link Recent Jobs to Deals (if deal exists)

#### **2. Sites Page (sites.html)**
- Add "Sales Mode" toggle in header
- When enabled:
  - Show deal value and stage on site cards
  - Add "Create Deal from Site" button
  - Show contact information if site has associated deal
  - Show quote status for site

#### **3. Bookings Page (bookings.html)**
- Add toggle in booking list header
- When enabled:
  - Show deal link on booking cards
  - Add "Convert to Deal" button
  - Show quote information if booking has quote
  - Add sales context to booking details

#### **4. Jobs Page (jobs.html)**
- Add toggle in jobs header
- When enabled:
  - Show deal association on job cards
  - Add "Link to Deal" button in job details
  - Show sales notes/comments
  - Add quote reference if job is from a quote

#### **5. Inventory Page (inventory.html)**
- Add toggle in inventory header
- When enabled:
  - Show items used in quotes
  - Add "Add to Quote" quick action
  - Show inventory value for quoting

#### **6. Messages Page (messages.html)**
- Add toggle in messages header
- When enabled:
  - Show sales sequences
  - Filter messages by deal/contact
  - Add "Start Sequence" from message
  - Show deal context in conversations

#### **7. Reports Page (reports.html)**
- Add toggle in reports header
- When enabled:
  - Show sales analytics tab
  - Add sales-specific reports
  - Show pipeline reports
  - Add revenue forecasting

#### **8. Routes Page (routes.html)**
- Add toggle in routes header
- When enabled:
  - Show deal creation from door visits
  - Link routes to territories
  - Show sales activity by route

---

## 🛠️ Implementation Plan

### **Step 1: Create Sales Mode Service**
Create `js/sales-mode.js`:
- Manages sales mode state (localStorage + user preference)
- Provides `isSalesModeEnabled()` function
- Provides `toggleSalesMode()` function
- Emits events for mode changes
- Syncs with user profile preferences

### **Step 2: Add UI Components**
- Create reusable sales mode toggle button component
- Add to all required pages (dashboard, sites, bookings, jobs, inventory, messages, reports, routes)
- Consistent styling and placement

### **Step 3: Feature Integration**
For each feature/page, add conditional rendering based on sales mode:

#### **Dashboard Integration:**
- `js/dashboard.js` - Add sales pipeline widget
- Show deal metrics in summary cards
- Add quick deal creation

#### **Sites Integration:**
- `js/sites.js` - Add deal information to site cards
- Add "Create Deal" button
- Show deal stage and value

#### **Bookings Integration:**
- `js/bookings.js` - Add deal conversion
- Show quote information
- Link bookings to deals

#### **Jobs Integration:**
- `js/jobs.js` - Add deal linking
- Show sales context
- Add quote references

#### **Inventory Integration:**
- `js/inventory.js` - Add quote integration
- Show items in active quotes
- Quick add to quote

#### **Messages Integration:**
- `js/messages.js` - Add sales sequences
- Filter by deal/contact
- Sales context in conversations

#### **Reports Integration:**
- `js/reports.js` - Add sales analytics
- Pipeline reports
- Revenue forecasting

#### **Routes Integration:**
- `js/routes.js` - Add deal creation from visits
- Territory sales tracking

### **Step 4: Database Integration**
- Store sales mode preference in `user_profiles` table (add `sales_mode_enabled` column)
- Or use existing preferences JSONB column

---

## 📝 Files to Modify

### **New Files:**
1. `js/sales-mode.js` - Sales mode service/manager
2. `css/sales-mode.css` - Sales mode specific styles

### **Files to Modify:**

#### **HTML Files:**
1. `dashboard.html` - Add toggle button, sales widgets
2. `sites.html` - Add toggle, deal info on cards
3. `bookings.html` - Add toggle, deal conversion
4. `jobs.html` - Add toggle, deal linking
5. `inventory.html` - Add toggle, quote integration
6. `messages.html` - Add toggle, sales sequences
7. `reports.html` - Add toggle, sales analytics
8. `routes.html` - Add toggle, deal creation

#### **JavaScript Files:**
1. `js/dashboard.js` - Sales pipeline widget, metrics
2. `js/sites.js` - Deal information, create deal button
3. `js/bookings.js` - Deal conversion, quote display
4. `js/jobs.js` - Deal linking, sales context
5. `js/inventory.js` - Quote integration
6. `js/messages.js` - Sales sequences, deal filtering
7. `js/reports.js` - Sales analytics, pipeline reports
8. `js/routes.js` - Deal creation from visits
9. `js/sales.js` - Already exists, integrate with sales mode

#### **SQL Files (Database Updates):**
1. Add `sales_mode_enabled` column to `user_profiles` table (or use existing preferences)

---

## ✅ Features to Enable in Sales Mode

### **New Features Created by Agents:**

1. **Recent Jobs Feature** (Agent)
   - Link jobs to deals when sales mode enabled
   - Show deal status on job cards
   - Add "View Deal" link

2. **Emergency Requests Feature** (Agent)
   - Convert emergency bookings to high-priority deals
   - Auto-create deal when emergency booking created (if sales mode on)

3. **Recurring Jobs Feature** (Agent)
   - Link recurring jobs to subscription deals
   - Show recurring deal value
   - Add deal context to recurring job series

4. **Recurring Bookings Feature** (Agent)
   - Convert recurring bookings to subscription deals
   - Show deal on booking card
   - Link to quote/contract

5. **Staff Timer Feature** (Agent)
   - Track time against deals (if job linked to deal)
   - Show billable hours on deal
   - Add time tracking to deal timeline

6. **Profile Picture Feature** (Agent)
   - Show profile pictures in deal contacts
   - Contact avatars in sales portal

7. **Worker Assignment Feature** (Agent)
   - Assign sales reps to deals
   - Show assigned rep on deal cards
   - Filter deals by assigned rep

8. **Auto Job Creation from Bookings** (Agent)
   - Link auto-created jobs to deals
   - Create deal if booking has quote
   - Show deal on job details

9. **Site Worker Assignment** (Agent)
   - Link site workers to territory reps
   - Show rep info on sites
   - Territory assignment

10. **Message Reactions** (Agent)
    - Sales-specific reactions (👍 interested, 💰 qualified, ❌ not interested)
    - Auto-update deal stage from reactions

11. **Group Conversations** (Agent)
    - Sales team group chats
    - Deal collaboration groups

---

## 🔧 Technical Implementation Details

### **Sales Mode Service (`js/sales-mode.js`)**
```javascript
// Pseudo-code structure
export const salesMode = {
  isEnabled: () => boolean,
  enable: () => void,
  disable: () => void,
  toggle: () => void,
  onChanged: (callback) => void,
  savePreference: () => Promise<void>
};
```

### **Database Schema Update**
```sql
-- Add to user_profiles (if not using preferences JSONB)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS sales_mode_enabled BOOLEAN DEFAULT false;

-- Or use existing preferences column
-- Update user_profiles.preferences to include sales_mode_enabled
```

### **Sales Mode Toggle Component**
- Reusable toggle button
- Consistent styling (matches dark mode toggle)
- Tooltip: "Toggle Sales Mode"
- Icon: Trending Up (📈) when enabled, Trending Down when disabled

---

## 📊 Execution Checklist

### **Phase 1: SQL Setup** ✅
- [ ] Run CORE_SALES_CRM_SCHEMA.sql
- [ ] Run CORE_SALES_CRM_RLS_AND_CONSTRAINTS.sql
- [ ] Run CORE_SALES_CRM_SEED_DATA.sql
- [ ] Run CORE_SALES_CRM_TESTS.sql (optional)
- [ ] Run ADD_SALES_PORTAL_SCHEMA.sql
- [ ] Run ADD_REP_ROLE_SUPPORT.sql
- [ ] Run ADD_RBAC_AUDIT_LOGGING.sql
- [ ] Run ADD_RECURRING_BILLING_CRON.sql
- [ ] Run ADD_QUO_CALLS_SCHEMA.sql
- [ ] Run ADD_QUO_POST_CALL_TRIGGER.sql
- [ ] Run ADD_ROUTE_MANAGEMENT_SCHEMA.sql
- [ ] Run ADD_ANALYTICS_SCHEMA.sql
- [ ] Run ADD_ANALYTICS_FUNCTIONS.sql

### **Phase 2: Sales Mode Service** ✅
- [ ] Create js/sales-mode.js
- [ ] Create css/sales-mode.css
- [ ] Add database column for preference storage
- [ ] Test sales mode service

### **Phase 3: UI Components** ✅
- [ ] Create reusable toggle button component
- [ ] Add toggle to dashboard.html
- [ ] Add toggle to sites.html
- [ ] Add toggle to bookings.html
- [ ] Add toggle to jobs.html
- [ ] Add toggle to inventory.html
- [ ] Add toggle to messages.html
- [ ] Add toggle to reports.html
- [ ] Add toggle to routes.html

### **Phase 4: Feature Integration** ✅
- [ ] Dashboard: Sales pipeline widget
- [ ] Dashboard: Sales metrics
- [ ] Sites: Deal information on cards
- [ ] Sites: Create deal button
- [ ] Bookings: Deal conversion
- [ ] Bookings: Quote display
- [ ] Jobs: Deal linking
- [ ] Jobs: Sales context
- [ ] Inventory: Quote integration
- [ ] Messages: Sales sequences
- [ ] Reports: Sales analytics
- [ ] Routes: Deal creation

### **Phase 5: Testing** ✅
- [ ] Test sales mode toggle across all pages
- [ ] Test feature visibility (on/off)
- [ ] Test data persistence (preference saved)
- [ ] Test integration with existing features
- [ ] Test role-based access (rep role)
- [ ] Test sales portal integration

---

## 🚀 Ready to Execute

**Status:** ⏳ Waiting for approval

When you say **"run it fam"**, I will:
1. Create all SQL files checklist
2. Implement sales mode service
3. Add toggle buttons to all pages
4. Integrate sales features into all new agent features
5. Test and verify everything works

**Ready when you are!** 🎯
