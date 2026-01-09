# 🎯 Sales Mode Button - Simplified Gameplan

## Overview
Replace the "All Sites" filter button with a "Sales Mode" toggle button **ONLY on the Overview page (dashboard)**.

---

## 🎨 What We're Doing

### **Current State:**
- Overview page has an "All Sites" filter button in the topbar (lines 164-179 in dashboard.html)
- Filter button has dropdown with: All Sites, Active, Paused, In Setup
- Used to filter sites by status

### **New State:**
- Replace "All Sites" filter button with "Sales Mode" toggle button
- Sales Mode button toggles between ON/OFF states
- When ON: Shows sales-related widgets/features on overview page
- When OFF: Normal overview page view

---

## 📋 Implementation Steps

### **Step 1: Create Sales Mode Service**
**File:** `js/sales-mode.js` (NEW)

**Purpose:** 
- Manages sales mode state (localStorage + user preference)
- Provides toggle functionality
- Emits events when mode changes

**Functions:**
- `isSalesModeEnabled()` - Returns boolean
- `toggleSalesMode()` - Toggles state
- `enableSalesMode()` - Enable sales mode
- `disableSalesMode()` - Disable sales mode
- `onChanged(callback)` - Listen for changes

**Storage:**
- Use localStorage: `nfg_sales_mode_enabled` (boolean)
- Optional: Save to user profile preferences (future enhancement)

---

### **Step 2: Replace Filter Button with Sales Mode Button**
**File:** `dashboard.html` (MODIFY)

**Location:** Lines 164-179 (topbar filter button section)

**Changes:**
1. **Remove:** Entire "All Sites" filter button and dropdown (lines 164-179)
2. **Add:** Sales Mode toggle button in same location

**New Button HTML:**
```html
<!-- Sales Mode Toggle Button -->
<button id="sales-mode-toggle" 
        class="flex items-center justify-center sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl border border-nfgray bg-white dark:bg-gray-800 hover:bg-nfglight dark:hover:bg-gray-600 transition flex-shrink-0"
        title="Toggle Sales Mode">
  <i data-lucide="trending-up" class="w-4 h-4"></i>
  <span id="sales-mode-label" class="hidden sm:inline text-xs sm:text-sm">Sales Mode</span>
</button>
```

**Visual States:**
- **OFF:** Gray border, white background, "Sales Mode" text
- **ON:** Blue border, blue background, white text, "Sales Mode ON" text

---

### **Step 3: Add Sales Mode JavaScript Logic**
**File:** `js/dashboard.js` (MODIFY)

**Changes:**
1. **Import sales mode service:**
   ```javascript
   import { salesMode } from './sales-mode.js';
   ```

2. **Initialize sales mode on page load:**
   - Check current state
   - Update button appearance
   - Show/hide sales widgets based on state

3. **Add event listener for toggle button:**
   ```javascript
   document.getElementById('sales-mode-toggle').addEventListener('click', () => {
     salesMode.toggle();
     updateSalesModeUI();
   });
   ```

4. **Create `updateSalesModeUI()` function:**
   - Updates button appearance (ON/OFF state)
   - Shows/hides sales widgets
   - Updates label text

5. **Remove filter-related code:**
   - Remove `currentSiteFilter` variable
   - Remove `filterSitesByStatus()` function calls
   - Remove filter dropdown event listeners
   - Keep site rendering but remove filtering logic

---

### **Step 4: Add Sales Widgets (When Sales Mode ON)**
**File:** `dashboard.html` (MODIFY)

**Location:** After KPI cards section (around line 236)

**Add Sales Pipeline Widget:**
```html
<!-- Sales Pipeline Widget (Only visible when Sales Mode ON) -->
<section id="sales-pipeline-widget" class="hidden bg-white dark:bg-gray-800 border border-nfgray dark:border-gray-700 rounded-xl shadow-nfg p-4">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-nfgblue dark:text-blue-400 font-semibold">Sales Pipeline</h3>
    <a href="sales.html" class="text-xs text-nfgblue dark:text-blue-400 hover:underline">View All</a>
  </div>
  <div id="sales-pipeline-content">
    <!-- Will be populated by JavaScript -->
    <div class="text-center py-4 text-gray-500">Loading pipeline...</div>
  </div>
</section>
```

**Add Sales Metrics to KPI Cards (Optional):**
- When sales mode ON, could show additional sales metrics
- Or keep existing KPI cards as-is

---

### **Step 5: Fetch Sales Data (When Sales Mode ON)**
**File:** `js/dashboard.js` (MODIFY)

**Add function to fetch sales data:**
```javascript
async function fetchSalesPipeline() {
  if (!salesMode.isEnabled()) return;
  
  try {
    // Fetch active deals
    const { data: deals, error } = await supabase
      .from('deals')
      .select('id, title, stage, deal_value, expected_close_date')
      .eq('status', 'active')
      .order('expected_close_date', { ascending: true })
      .limit(5);
    
    if (error) throw error;
    
    // Render deals in sales pipeline widget
    renderSalesPipeline(deals);
  } catch (error) {
    console.error('Error fetching sales pipeline:', error);
  }
}
```

**Add function to render sales pipeline:**
```javascript
function renderSalesPipeline(deals) {
  const container = document.getElementById('sales-pipeline-content');
  if (!container) return;
  
  if (!deals || deals.length === 0) {
    container.innerHTML = '<div class="text-center py-4 text-gray-500">No active deals</div>';
    return;
  }
  
  // Render deals list
  container.innerHTML = deals.map(deal => `
    <div class="border-b border-nfgray dark:border-gray-700 py-2 last:border-0">
      <div class="flex items-center justify-between">
        <div>
          <p class="font-medium text-sm">${deal.title}</p>
          <p class="text-xs text-gray-500">${deal.stage}</p>
        </div>
        <div class="text-right">
          <p class="font-semibold text-sm">$${deal.deal_value?.toLocaleString() || '0'}</p>
        </div>
      </div>
    </div>
  `).join('');
}
```

**Call fetchSalesPipeline when:**
- Sales mode is enabled
- Page loads (if sales mode already enabled)
- Sales mode is toggled ON

---

## 📝 Files to Modify

### **New Files:**
1. ✅ `js/sales-mode.js` - Sales mode service/manager

### **Files to Modify:**
1. ✅ `dashboard.html` 
   - Remove: "All Sites" filter button (lines 164-179)
   - Add: Sales Mode toggle button
   - Add: Sales Pipeline widget section

2. ✅ `js/dashboard.js`
   - Import sales mode service
   - Remove filter-related code
   - Add sales mode toggle handler
   - Add sales pipeline fetch/render functions
   - Update UI based on sales mode state

---

## 🎨 Visual Design

### **Sales Mode Button States:**

**OFF State:**
- Border: `border-nfgray`
- Background: `bg-white dark:bg-gray-800`
- Text: "Sales Mode"
- Icon: `trending-up` (gray)

**ON State:**
- Border: `border-nfgblue`
- Background: `bg-nfgblue`
- Text: "Sales Mode ON" (white)
- Icon: `trending-up` (white)

**Hover State:**
- Background: `hover:bg-nfglight dark:hover:bg-gray-600`

---

## ✅ Implementation Checklist

### **Phase 1: Sales Mode Service**
- [ ] Create `js/sales-mode.js`
- [ ] Implement `isSalesModeEnabled()`
- [ ] Implement `toggleSalesMode()`
- [ ] Implement `enableSalesMode()`
- [ ] Implement `disableSalesMode()`
- [ ] Implement `onChanged(callback)`
- [ ] Test service in console

### **Phase 2: HTML Changes**
- [ ] Remove "All Sites" filter button from dashboard.html
- [ ] Add Sales Mode toggle button
- [ ] Add Sales Pipeline widget section
- [ ] Test button appears correctly

### **Phase 3: JavaScript Integration**
- [ ] Import sales mode service in dashboard.js
- [ ] Remove filter-related code
- [ ] Add toggle button event listener
- [ ] Create `updateSalesModeUI()` function
- [ ] Create `fetchSalesPipeline()` function
- [ ] Create `renderSalesPipeline()` function
- [ ] Initialize sales mode on page load
- [ ] Test toggle functionality

### **Phase 4: Testing**
- [ ] Test button toggles ON/OFF
- [ ] Test button state persists (localStorage)
- [ ] Test sales pipeline widget shows/hides
- [ ] Test sales data fetches when mode ON
- [ ] Test sales data doesn't fetch when mode OFF
- [ ] Test on page refresh (state persists)
- [ ] Test dark mode compatibility

---

## 🚀 Ready to Execute

**Status:** ⏳ Waiting for approval

When you say **"run it fam"**, I will:
1. ✅ Create `js/sales-mode.js` service
2. ✅ Replace "All Sites" filter button with Sales Mode toggle in `dashboard.html`
3. ✅ Add Sales Pipeline widget section to `dashboard.html`
4. ✅ Update `js/dashboard.js` to integrate sales mode
5. ✅ Remove filter-related code
6. ✅ Add sales pipeline fetch/render functions
7. ✅ Test everything works

**Simple and focused - just the Overview page!** 🎯
