# Tools and Resources Page - Planning Document

## Overview
Add a new "Tools and Resources" tab to the Sales Portal that provides sales reps with quick access to calculators, templates, guides, and helpful resources.

## Current Sales Portal Structure
- **Tabs:** Dashboard, Deals, Quotes, Contacts, Team
- **New Tab:** Tools & Resources (6th tab)

---

## Page Structure & Layout

### 1. **Header Section**
- Title: "Tools & Resources"
- Subtitle: "Quick access to calculators, templates, and sales resources"
- Search bar (optional - for filtering resources)

### 2. **Main Content - Grid Layout**
Organized into **cards/sections** with icons:

#### **Section 1: Calculators & Tools**
- **Quote Calculator**
  - Input: Service type, square footage, frequency
  - Output: Estimated quote price
  - Quick action: "Create Quote from Calculation"
  
- **ROI Calculator**
  - Input: Current costs, proposed savings
  - Output: ROI percentage, payback period
  - Visual chart/graph
  
- **Commission Calculator**
  - Input: Deal value, commission rate
  - Output: Commission amount
  - (Role-based: only visible to reps/managers)

- **Pricing Guide**
  - Reference table for standard pricing
  - By service type, frequency, size
  - Searchable/filterable

#### **Section 2: Templates & Scripts**
- **Email Templates**
  - Follow-up emails
  - Proposal emails
  - Thank you emails
  - Customizable with merge fields
  
- **Call Scripts**
  - Cold call script
  - Follow-up call script
  - Objection handling
  - Discovery questions
  
- **Quote Templates**
  - Quick access to saved quote templates
  - "Create from Template" button

#### **Section 3: Training & Documentation**
- **Sales Playbooks**
  - Step-by-step guides
  - Best practices
  - Common scenarios
  
- **Product Knowledge**
  - Service descriptions
  - Features & benefits
  - Technical specs
  
- **Video Tutorials**
  - Embedded videos or links
  - How-to guides
  - Training modules

#### **Section 4: Quick Links & Resources**
- **External Tools**
  - CRM links
  - Email tools
  - Calendar/scheduling
  - Communication platforms
  
- **Company Resources**
  - Company handbook
  - Policies
  - Support contacts
  - Internal wiki/knowledge base
  
- **Help & Support**
  - FAQ section
  - Contact support
  - Bug reporting
  - Feature requests

---

## Technical Implementation

### **File Structure**
```
sales.html
  - Add new tab button: "Tools & Resources"
  - Add new tab content: <div id="tab-tools">
  
js/sales-tools.js (new file)
  - Calculator functions
  - Template loading
  - Resource management
```

### **Database Schema (if needed)**
Consider adding:
- `sales_resources` table (for dynamic resources)
- `email_templates` table (if not exists)
- `call_scripts` table (if not exists)

### **Features to Implement**

#### **Phase 1: Basic Structure**
1. Add tab button and content area
2. Create grid layout with sections
3. Add placeholder cards for each tool/resource
4. Basic styling matching sales portal theme

#### **Phase 2: Calculators**
1. Quote Calculator (interactive form)
2. ROI Calculator (with visualizations)
3. Commission Calculator (role-based)
4. Pricing Guide (static reference table)

#### **Phase 3: Templates**
1. Email template library
2. Call script library
3. Quote template quick access
4. Copy-to-clipboard functionality

#### **Phase 4: Resources**
1. Training materials (links/files)
2. Product documentation
3. Video tutorials (embedded or links)
4. Quick links section

#### **Phase 5: Advanced Features**
1. Search/filter functionality
2. Favorites/bookmarks
3. Recently used tools
4. Usage analytics (for admins)

---

## UI/UX Design

### **Card Design**
- Each tool/resource as a card
- Icon + Title + Description
- Hover effects
- Click to open/expand

### **Modal/Expanded Views**
- Calculators: Inline or modal
- Templates: Modal with preview
- Resources: New tab or modal

### **Responsive Design**
- Mobile-friendly grid (2 columns on mobile, 3-4 on desktop)
- Collapsible sections
- Touch-friendly buttons

### **Visual Hierarchy**
- Group related tools together
- Use icons to distinguish categories
- Color coding by category (optional)

---

## Content to Include

### **Calculators**
1. **Quote Calculator**
   - Service selection dropdown
   - Square footage input
   - Frequency selection
   - Location/region factor
   - Calculate button → shows estimated price
   - "Create Quote" button (links to Quotes tab)

2. **ROI Calculator**
   - Current monthly cost
   - Proposed monthly cost
   - One-time setup cost
   - Calculate → shows ROI %, payback period, savings

3. **Commission Calculator**
   - Deal value input
   - Commission rate (auto-filled based on role)
   - Calculate → shows commission amount

4. **Pricing Guide**
   - Table view: Service | Frequency | Price Range
   - Filterable by service type
   - Searchable

### **Templates**
1. **Email Templates**
   - List of templates with preview
   - Categories: Follow-up, Proposal, Thank You, etc.
   - Click to view full template
   - "Use Template" button → opens email composer

2. **Call Scripts**
   - List of scripts
   - Categories: Cold Call, Follow-up, Objection Handling
   - Expandable sections
   - Print-friendly format

3. **Quote Templates**
   - Quick links to existing quote templates
   - "Create from Template" → opens quote builder

### **Resources**
1. **Training Materials**
   - Links to documents/PDFs
   - Video links
   - Step-by-step guides

2. **Product Knowledge**
   - Service descriptions
   - FAQ section
   - Technical documentation

3. **Quick Links**
   - External tools (CRM, email, calendar)
   - Company resources
   - Support contacts

---

## Implementation Priority

### **MVP (Minimum Viable Product)**
1. ✅ Tab structure and layout
2. ✅ Quote Calculator (basic)
3. ✅ Email Templates (static list)
4. ✅ Quick Links section
5. ✅ Basic styling

### **Phase 2**
1. ROI Calculator
2. Call Scripts library
3. Training materials section
4. Search functionality

### **Phase 3**
1. Commission Calculator
2. Quote template quick access
3. Product knowledge base
4. Favorites/bookmarks

### **Phase 4**
1. Advanced calculators
2. Interactive templates
3. Usage analytics
4. Admin management tools

---

## Questions to Consider

1. **Should calculators save results?**
   - Save to user history?
   - Export to PDF?
   - Share with team?

2. **Template management:**
   - Who can create/edit templates?
   - Admin-only or user-contributed?
   - Version control?

3. **Resource access:**
   - Role-based visibility?
   - Public vs. private resources?
   - Permission levels?

4. **Integration:**
   - Link calculators directly to quote creation?
   - Pre-fill forms from calculator results?
   - Export data to deals/quotes?

5. **Analytics:**
   - Track which tools are used most?
   - Show usage stats to admins?
   - Identify training gaps?

---

## Next Steps

1. **Review this plan** - Confirm sections and priorities
2. **Design mockups** - Visual layout approval
3. **Content gathering** - Collect templates, scripts, resources
4. **Database schema** - Decide if new tables needed
5. **Implementation** - Start with MVP features
6. **Testing** - User feedback and iteration

---

## Notes

- Keep it simple initially - can expand based on usage
- Focus on tools that save time and improve efficiency
- Make resources easily accessible (no more than 2 clicks)
- Consider mobile users - ensure responsive design
- Regular updates - keep content fresh and relevant
