# Quote System Upgrade Gameplan

## Overview
Transform the quote system by:
1. Removing "Ballpark Estimate" option
2. Converting "Walkthrough Required" to a welcome email workflow (not a quote)
3. Implementing comprehensive Quote Calculation Engine v2 for "Standard Quote"

---

## PHASE 1: Remove Ballpark & Update Walkthrough Flow

### 1.1 Remove Ballpark Estimate from UI
**Files to modify:**
- `sales.html` (lines ~1220, ~547)
- `js/quote-wizard.js` (remove ballpark logic)
- `js/quotes.js` (remove ballpark handling)
- `js/quote-detail.js` (remove ballpark display)

**Changes:**
- Remove `<option value="ballpark">Ballpark Estimate</option>` from all select dropdowns
- Remove ballpark-specific validation and logic
- Update default quote_type to 'standard' instead of 'walkthrough_required'

### 1.2 Convert Walkthrough to Welcome Email Flow
**Files to modify:**
- `sales.html` (quote wizard modal)
- `js/quote-wizard.js` (walkthrough handling)
- `js/services/quote-service.js` (if exists)

**Changes:**
- When quote_type = 'walkthrough_required':
  - Skip pricing/line items steps
  - After all info collected, send welcome email instead of creating quote
  - Create a "walkthrough request" record (not a quote)
  - Show success: "Welcome email sent! We'll schedule a walkthrough."

**New function needed:**
- `sendWalkthroughWelcomeEmail(contactData, accountData)`
- `createWalkthroughRequest(data)`

---

## PHASE 2: Build Quote Calculation Engine v2

### 2.1 Create Core Engine Structure
**New files to create:**
```
js/quote-engine/
├── config.js          # Admin-configurable pricing rules
├── types.js           # TypeScript-like type definitions (JSDoc)
├── calculator.js      # Main calculation logic
├── email-template.js  # Quote email generation
└── __tests__/
    └── calculator.test.js  # Unit tests
```

### 2.2 Implement Configuration (`config.js`)
**Structure:**
```javascript
export const QUOTE_CONFIG = {
  // Base monthly prices (ex-HST) for 4 visits/mo, 1200-1600 sqft band
  basePrices: {
    commercial_office: 349,
    physio_chiro: 579,
    medical_clinic: 649,
    dental: 699,
    optical: 599,
    industrial: 799,
    residential_common_area: 499
  },
  
  // Sqft bands with multipliers
  sqftBands: [
    { min: 0, max: 1200, multiplier: 0.92, label: 'band_1' },
    { min: 1201, max: 1600, multiplier: 1.00, label: 'band_2' }, // baseline
    { min: 1601, max: 2000, multiplier: 1.14, label: 'band_3' },
    { min: 2001, max: 2600, multiplier: 1.32, label: 'band_4', walkthroughRequired: true },
    { min: 2601, max: 3500, multiplier: 1.55, label: 'band_5', walkthroughRequired: true },
    { min: 3501, max: Infinity, multiplier: null, label: 'band_6', customOnly: true }
  ],
  
  // Frequency multipliers (non-linear curve)
  frequencyMultipliers: [
    { maxVisits: 4, multiplier: 1.00 },
    { maxVisits: 8, multiplier: 1.80 },
    { maxVisits: 12, multiplier: 2.45 },
    { maxVisits: 16, multiplier: 3.05 },
    { maxVisits: 20, multiplier: 3.70 },
    { maxVisits: Infinity, multiplier: null, customOnly: true }
  ],
  
  // Touchpoint scoring
  touchpointScores: {
    washroom: 0.08,        // per washroom, cap 0.32 (4 washrooms)
    treatment_room: 0.05,  // per room, cap 0.25 (5 rooms)
    reception: 0.06,
    kitchen: 0.06,
    high_touch_disinfection: 0.08
  },
  touchpointMax: 0.45,  // Cap total touchpoint multiplier at +0.45
  
  // Complexity factors
  complexityFactors: {
    flooring: {
      mostly_hard: 0.00,
      mixed: 0.06,
      mostly_carpet: 0.10
    },
    after_hours: 0.08,
    supplies_included: 0.06,
    urgency: {
      '0-2': 0.10,
      '3-7': 0.05,
      '8+': 0.00
    }
  },
  complexityMax: 0.30,  // Cap complexity adders at +0.30
  
  // Minimum monthly floors
  minimumMonthly: {
    commercial_office: 349,
    physio_chiro: 579,
    medical_clinic: 649,
    dental: 699,
    optical: 599,
    industrial: 799,
    residential_common_area: 499
  },
  
  // HST
  hstRate: 0.13,  // Ontario default
  
  // Walkthrough triggers
  walkthroughTriggers: {
    maxSqftBand: 3,  // band_3 = 2000 sqft
    maxTreatmentRooms: 8,
    customKeywords: ['construction dust', 'biohazard', 'flood', 'mold']
  },
  
  // Quote validity
  quoteValidForDays: 14
};
```

### 2.3 Implement Calculator (`calculator.js`)
**Main function:**
```javascript
export function calculateQuote(inputs) {
  // 1. Validate inputs
  // 2. Determine sqft band
  // 3. Check if custom-only (requires walkthrough)
  // 4. Calculate base price
  // 5. Apply frequency multiplier
  // 6. Calculate touchpoint multiplier
  // 7. Calculate complexity multiplier
  // 8. Apply minimum floor
  // 9. Round to nearest $10
  // 10. Calculate per-visit price
  // 11. Calculate HST
  // 12. Determine walkthrough requirement
  // 13. Generate assumptions/cap language
  // 14. Return quote result object
}
```

**Output structure:**
```javascript
{
  monthly_price_ex_hst: number,
  hst_amount: number,
  monthly_price_inc_hst: number,
  per_visit_price: number,
  assumptions: {
    sqft_cap: number,
    band_label: string,
    supplies_included: boolean,
    healthcare_disinfection: boolean
  },
  line_items: [
    { name: 'Base Service', amount: number },
    { name: 'Touchpoint Density', amount: number },
    { name: 'Complexity Premium', amount: number },
    { name: 'After Hours Premium', amount: number },
    { name: 'Urgency Premium', amount: number }
  ],
  recommended_frequency_upsell: string | null,
  quote_valid_for_days: 14,
  walkthrough_required: boolean,
  status: 'quote' | 'requires_walkthrough',
  price_range: [min, max] | null,
  recommended_action: 'send_quote' | 'book_walkthrough'
}
```

### 2.4 Implement Email Template (`email-template.js`)
**Function:**
```javascript
export function generateQuoteEmail(quoteResult, businessData, contactData) {
  // Generate plain text email with:
  // - Business name & address
  // - Frequency
  // - Scope bullets (auto-selected by service_type)
  // - Investment and HST
  // - Cap/assumption line
  // - Start date promise (if urgency <= 7 days)
  // - NFG phone numbers and signature
}
```

### 2.5 Unit Tests (`calculator.test.js`)
**Test cases:**
1. MEX Physio scenario (1000 sqft, 4/mo, 3 rooms, etc.)
2. Dental 1500 sqft, 4/mo
3. Office 1500 sqft, 4/mo
4. >3500 sqft (custom_only)
5. Edge cases: missing sqft, high frequency, all touchpoints

---

## PHASE 3: Update Quote Wizard UI

### 3.1 Update Step 2 (Context) - Remove Ballpark
**File: `sales.html`**
- Remove ballpark option from quote type select
- Update default to 'standard'
- Keep 'walkthrough_required' but change label/description

### 3.2 Update Step 3 (Pricing) - New Quote Form
**File: `sales.html` (quote wizard modal)**
**New form fields:**
- service_type (dropdown)
- sqft_estimate (number, optional)
- frequency_per_month (number)
- num_washrooms (number, 0-10+)
- num_treatment_rooms (number, 0-20+)
- has_reception (checkbox)
- has_kitchen (checkbox)
- flooring (radio: mostly_hard | mixed | mostly_carpet)
- after_hours_required (checkbox)
- supplies_included (checkbox, default true)
- high_touch_disinfection (checkbox, default true for healthcare)
- urgency_start_days (number, 0-30)
- notes (textarea)

**Display:**
- Real-time price calculation as user fills form
- Show price range + "firm quote" with cap language
- Show "No walkthrough needed" vs "Walkthrough recommended"
- Show assumptions (sqft cap, band label)

### 3.3 Update Step 4 (Terms) - Show Quote Breakdown
**File: `sales.html`**
- Display line items breakdown
- Show monthly ex-HST, HST, monthly inc-HST, per-visit
- Show assumptions and cap language
- Show generated quote email preview
- Export quote email button

### 3.4 Update Walkthrough Flow
**File: `js/quote-wizard.js`**
- When quote_type = 'walkthrough_required':
  - Skip pricing step
  - After context step, show "Send Welcome Email" button
  - On send: create walkthrough request + send email
  - Show success message

---

## PHASE 4: Database & API Integration

### 4.1 Update Quotes Schema
**File: Create migration or update existing**
- Add `quote_engine_version` field (default 'v2')
- Add `quote_calculation_inputs` JSONB field
- Add `quote_calculation_outputs` JSONB field
- Add `quote_breakdown` JSONB field (line items, assumptions)
- Keep existing fields for backward compatibility

### 4.2 Create API Endpoint
**File: `js/services/quote-service.js` or new API file**
```javascript
export async function calculateQuote(inputs) {
  // Server-side calculation using quote engine
  // Return quote result
}
```

### 4.3 Update Quote Saving
**File: `js/quote-wizard.js`**
- When saving standard quote:
  - Call quote engine calculator
  - Save inputs + outputs + breakdown to database
  - Include quote_engine_version = 'v2'

---

## PHASE 5: Integration & Testing

### 5.1 Integration Points
- Hook quote engine into existing "Create Quote" flow
- Update quote detail page to show new breakdown format
- Update quote list to show quote engine version
- Ensure backward compatibility with old quotes

### 5.2 Acceptance Tests
1. ✅ MEX Physio scenario → ~529-649 range
2. ✅ Dental 1500 sqft → ~599-799 range
3. ✅ Office 1500 sqft → ~349-449 range
4. ✅ >3500 sqft → requires_walkthrough
5. ✅ Walkthrough flow → sends welcome email, no quote created

### 5.3 Edge Cases
- Missing sqft estimate → use conservative default band
- Very high frequency → custom_only
- All touchpoints maxed → cap at 1.45 multiplier
- All complexity factors → cap at +0.30
- Industrial service type → walkthrough_required default

---

## PHASE 6: Admin Configuration

### 6.1 Create Admin Config UI (Optional Future)
- Settings page section for quote pricing
- Allow editing base prices, multipliers, bands
- Save to config file or database
- Validate changes before saving

### 6.2 For Now
- Keep config in `js/quote-engine/config.js`
- Document how to update pricing
- Add comments explaining each setting

---

## File Summary

### Files to Create:
1. `js/quote-engine/config.js`
2. `js/quote-engine/types.js` (JSDoc types)
3. `js/quote-engine/calculator.js`
4. `js/quote-engine/email-template.js`
5. `js/quote-engine/__tests__/calculator.test.js`
6. `js/services/walkthrough-service.js` (for welcome email)

### Files to Modify:
1. `sales.html` (quote wizard modal, remove ballpark, add new fields)
2. `js/quote-wizard.js` (integrate engine, update walkthrough flow)
3. `js/quotes.js` (remove ballpark, update quote creation)
4. `js/quote-detail.js` (display new breakdown format)
5. `QUOTE_SYSTEM_SCHEMA.sql` (add new fields, remove ballpark from enum)

### Files to Review:
1. `js/services/quote-service.js` (if exists, add calculateQuote endpoint)
2. Database migration for new quote fields

---

## Implementation Order

1. **Phase 1** - Quick wins: Remove ballpark, update walkthrough
2. **Phase 2** - Core engine: Build calculator, config, email template
3. **Phase 3** - UI updates: New form fields, real-time calculation
4. **Phase 4** - Database: Schema updates, API endpoint
5. **Phase 5** - Integration: Hook everything together
6. **Phase 6** - Polish: Admin config, documentation

---

## Notes

- Keep backward compatibility with existing quotes
- All calculations must be deterministic (same inputs = same outputs)
- Rounding rules: monthly to nearest $10, per-visit to nearest $5
- Walkthrough welcome email should include business info and next steps
- Quote email template must be professional and include all required legal/cap language

---

## Ready to Execute

When you say "go", I will:
1. Start with Phase 1 (remove ballpark, update walkthrough)
2. Build the quote engine (Phase 2)
3. Update UI (Phase 3)
4. Integrate everything (Phase 4-5)
5. Test all scenarios
6. Push to git

**Estimated implementation time:** ~2-3 hours for full implementation
