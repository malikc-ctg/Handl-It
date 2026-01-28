# Team Tab Sales Orientation Plan

## Overview
Transform the Team tab from operational metrics (Jobs, Sites, Completed) to sales-focused metrics that help managers track and motivate their sales team.

---

## Current State Analysis

### Current Metrics Displayed
**Summary Cards (Top):**
- Total, Active, Pending, Inactive (status counts)
- Admins, Staff, Clients (role counts)

**Individual Team Member Cards:**
- **Jobs**: Number of jobs assigned (operational)
- **Completed**: Number of jobs completed (operational)
- **Sites**: Number of sites assigned (operational)

### Current Filters
- Search by name, email, phone
- Role filter (Admin, Staff, Client)
- Status filter (Active, Pending, Inactive)
- Sort by: Name (A-Z), Most Jobs, Most Sites, Last Active

---

## Proposed Sales-Oriented Changes

### 1. Summary Statistics (Top Cards)

**Replace with Sales KPIs:**
- **Total Revenue** - Sum of all closed_won deals (all time or period)
- **Active Deals** - Count of deals not in closed_won/closed_lost
- **Quotes Sent** - Count of quotes with status 'sent'
- **Win Rate** - Percentage of closed deals that are won
- **Avg Deal Value** - Average value of closed_won deals
- **Pipeline Value** - Sum of deal_value for active deals
- **This Month Revenue** - Revenue from closed_won deals this month

**Alternative Compact Layout (7 cards):**
1. Total Revenue (all time)
2. This Month Revenue
3. Active Deals
4. Quotes Sent
5. Win Rate (%)
6. Avg Deal Value
7. Pipeline Value

---

### 2. Individual Team Member Cards

**Replace operational metrics with sales metrics:**

**Primary Metrics (3 columns):**
- **Deals** - Total active deals assigned to this user
- **Revenue** - Total revenue from closed_won deals (formatted as currency)
- **Win Rate** - Percentage: (closed_won / (closed_won + closed_lost)) × 100

**Alternative Metrics (if space allows):**
- **Quotes** - Number of quotes sent by this user
- **Calls** - Number of calls made (from call_logs)
- **Conversion** - Quotes → Wins conversion rate

**Visual Enhancements:**
- Add trend indicators (↑/↓) comparing to previous period
- Color-code metrics (green for good, red for needs attention)
- Show "vs. Team Avg" comparison badges

---

### 3. Enhanced Filters & Sorting

**New Sales-Focused Filters:**
- **Performance Filter:**
  - Top Performers (top 25% by revenue)
  - Above Average
  - Below Average
  - Needs Attention (no activity in 30 days)
  
- **Revenue Range Filter:**
  - $0 - $10k
  - $10k - $50k
  - $50k - $100k
  - $100k+

**New Sort Options:**
- Revenue (High to Low)
- Revenue (Low to High)
- Win Rate (High to Low)
- Active Deals (Most to Least)
- Quotes Sent (Most to Least)
- Last Activity (Most Recent)

**Keep Existing:**
- Search by name, email, phone
- Role filter
- Status filter

---

### 4. Team Member Card Details

**Enhanced "View Details" Button:**
When clicked, show a modal or expandable section with:
- **Sales Performance Breakdown:**
  - Deals by Stage (prospecting, qualification, proposal, negotiation, closed_won, closed_lost)
  - Revenue by Month (last 6 months chart)
  - Top Deals (highest value deals)
  - Recent Activity (last 5 calls, quotes, messages)
  
- **Quick Actions:**
  - View All Deals
  - View All Quotes
  - View Activity Timeline
  - Send Message

---

### 5. Data Requirements

**New Queries Needed:**

1. **Per-User Sales Stats:**
   ```sql
   -- Deals assigned (check both columns)
   SELECT COUNT(*) FROM deals 
   WHERE (assigned_to = userId OR assigned_user_id = userId)
     AND stage NOT IN ('closed_won', 'closed_lost');
   
   -- Revenue (closed_won deals)
   SELECT COUNT(*), SUM(deal_value) FROM deals 
   WHERE (assigned_to = userId OR assigned_user_id = userId)
     AND stage = 'closed_won';
   
   -- Win rate
   SELECT 
     COUNT(*) FILTER (WHERE stage = 'closed_won') as won,
     COUNT(*) FILTER (WHERE stage IN ('closed_won', 'closed_lost')) as total_closed
   FROM deals 
   WHERE (assigned_to = userId OR assigned_user_id = userId);
   
   -- Quotes sent (via deals)
   SELECT COUNT(*) FROM quotes q
   JOIN deals d ON q.deal_id = d.id
   WHERE (d.assigned_to = userId OR d.assigned_user_id = userId)
     AND q.status = 'sent';
   
   -- Calls made
   SELECT COUNT(*) FROM calls 
   WHERE user_id = userId;
   
   -- Last activity (most recent deal update or call)
   SELECT GREATEST(
     MAX(d.updated_at),
     MAX(c.created_at)
   ) FROM deals d
   LEFT JOIN calls c ON c.user_id = userId
   WHERE (d.assigned_to = userId OR d.assigned_user_id = userId);
   ```

2. **Aggregate Team Stats:**
   ```sql
   - Total revenue (all closed_won deals)
   - Active deals count
   - Quotes sent count
   - Win rate calculation
   - Average deal value
   - Pipeline value (sum of active deal values)
   ```

3. **Time-Period Filtering:**
   - Support "This Month", "This Quarter", "This Year", "All Time"
   - Default to "This Month" for current performance focus

---

### 6. Implementation Steps

#### Phase 1: Data Layer
1. ✅ Create `fetchEmployeeSalesStats()` function
   - Query deals table by `assigned_to` or `assigned_user_id`
   - Aggregate revenue, counts, win rates per user
   - Include quotes and calls data
   
2. ✅ Create `fetchTeamSalesSummary()` function
   - Calculate aggregate team metrics
   - Support time period filtering

#### Phase 2: UI Updates
1. ✅ Update summary cards HTML
   - Replace 7 current cards with sales KPI cards
   - Add time period selector (This Month, This Quarter, This Year, All Time)

2. ✅ Update employee card rendering
   - Replace Jobs/Completed/Sites with Deals/Revenue/Win Rate
   - Add currency formatting for revenue
   - Add percentage formatting for win rate
   - Add visual indicators (trend arrows, badges)

3. ✅ Update filters section
   - Add Performance filter dropdown
   - Add Revenue Range filter
   - Update sort options

#### Phase 3: Enhanced Features
1. ✅ Implement "View Details" modal/expansion
   - Sales performance breakdown
   - Revenue chart
   - Recent activity feed

2. ✅ Add comparison features
   - "vs. Team Avg" badges
   - Trend indicators (↑/↓ from last period)

3. ✅ Add export functionality
   - Export team performance report (CSV/PDF)

---

### 7. Database Schema Considerations

**✅ Verified Columns Exist:**
- `deals.assigned_to` - User assignment (ADD_SALES_PORTAL_SCHEMA.sql line 44)
- `deals.assigned_user_id` - Alternative column (CORE_SALES_CRM_SCHEMA) - handle both
- `deals.deal_value` - Revenue calculation (line 37)
- `deals.stage` - For filtering closed_won/closed_lost (line 34)
- `quotes.deal_id` - Link to deals (no direct user assignment, link through deals)
- `calls.user_id` - Direct user assignment (ADD_QUO_CALLS_SCHEMA.sql line 49)
- `calls.deal_id` - Also links to deals (line 46)

**Query Strategy:**
- **Deals**: Query `deals` where `assigned_to = userId OR assigned_user_id = userId`
- **Quotes**: Join `quotes` → `deals` → filter by `deals.assigned_to = userId`
- **Calls**: Query `calls` where `user_id = userId` (direct) OR `deal_id IN (user's deals)` (via deals)

---

### 8. Visual Design Updates

**Color Scheme:**
- Revenue: Green (#10b981)
- Active Deals: Blue (#3b82f6)
- Win Rate: Purple (#8b5cf6)
- Needs Attention: Red (#ef4444)

**Icons:**
- Revenue: Dollar sign or trending-up
- Deals: Briefcase
- Win Rate: Target or trophy
- Quotes: File-text
- Calls: Phone

**Badges:**
- "Top Performer" (gold badge)
- "On Track" (green badge)
- "Needs Attention" (red badge)

---

### 9. Performance Considerations

**Optimization:**
- Cache team stats for 5 minutes
- Use aggregated views if possible
- Lazy load detailed stats (only when "View Details" clicked)
- Paginate team member list if > 50 members

**Indexes Needed (verify they exist):**
- `deals(assigned_to, stage, deal_value)` - For user deal queries
- `deals(assigned_user_id, stage, deal_value)` - Alternative column
- `quotes(deal_id, status)` - For quote counts via deals
- `calls(user_id, created_at)` - For user call counts
- `calls(deal_id, created_at)` - For calls via deals

---

### 10. Testing Checklist

- [ ] Summary stats calculate correctly
- [ ] Individual cards show correct sales metrics
- [ ] Filters work (performance, revenue range)
- [ ] Sorting works (revenue, win rate, etc.)
- [ ] Time period selector updates all metrics
- [ ] "View Details" shows correct breakdown
- [ ] Handles users with no deals gracefully
- [ ] Handles division by zero (win rate when no closed deals)
- [ ] Currency formatting correct
- [ ] Percentage formatting correct
- [ ] Dark mode styling works
- [ ] Mobile responsive

---

## Implementation Priority

**High Priority (MVP):**
1. Replace Jobs/Completed/Sites with Deals/Revenue/Win Rate
2. Update summary cards to sales KPIs
3. Add sales-focused sort options

**Medium Priority:**
4. Add performance filters
5. Add time period selector
6. Implement "View Details" modal

**Low Priority (Nice to Have):**
7. Trend indicators
8. Team average comparisons
9. Export functionality
10. Revenue charts in details view

---

## Questions Resolved ✅

1. **Which column is used for deal assignment?**
   - ✅ **Answer**: `deals.assigned_to` (from ADD_SALES_PORTAL_SCHEMA.sql)
   - Note: CORE_SALES_CRM_SCHEMA uses `assigned_user_id`, but code handles both with OR query
   - **Implementation**: Query both columns: `assigned_to.eq.${userId} OR assigned_user_id.eq.${userId}`

2. **How are quotes assigned to users?**
   - ✅ **Answer**: Quotes link through deals via `quotes.deal_id`
   - No direct `assigned_to` on quotes table
   - **Implementation**: Join quotes → deals → get assigned_to from deal

3. **How are calls tracked per user?**
   - ✅ **Answer**: `calls.user_id` column exists (from ADD_QUO_CALLS_SCHEMA.sql line 49)
   - Also has `calls.deal_id` for linking to deals
   - **Implementation**: Query `calls.user_id = ${userId}` directly

4. **Time Period Default:**
   - ✅ **Decision**: Default to **"This Month"** for current performance focus
   - Add selector: "This Month", "This Quarter", "This Year", "All Time"

5. **Empty State Handling:**
   - ✅ **Decision**: Show **"0"** for all metrics (not "N/A" or "—")
   - This keeps the UI consistent and shows clear performance gaps

---

## Next Steps

1. Review this plan with stakeholders
2. Resolve questions above
3. Verify database schema columns
4. Create implementation todo list
5. Begin Phase 1 (Data Layer)
