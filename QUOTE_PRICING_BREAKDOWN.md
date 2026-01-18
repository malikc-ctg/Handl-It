# Quote Engine v2 - Complete Pricing Breakdown

## Overview
The Quote Engine v2 uses a **multiplicative pricing model** that factors in service type, square footage bands, frequency, touchpoint density, and complexity. Pricing is **deterministic** - the same inputs always produce the same output.

---

## 📋 INPUT PARAMETERS

### Required Parameters
1. **`service_type`** (string, required)
   - Options: `commercial_office`, `physio_chiro`, `medical_clinic`, `dental`, `optical`, `industrial`, `residential_common_area`
   - Determines base price and minimum monthly floor

2. **`frequency_per_month`** (number, required)
   - Number of cleaning visits per month
   - Range: 1-20 (above 20 requires walkthrough)
   - Default: 4 (weekly)

### Optional Parameters
3. **`sqft_estimate`** (number, optional)
   - Estimated square footage of facility
   - Used to determine sqft band multiplier
   - Can be null (uses band_1 pricing)

4. **`num_washrooms`** (number, default: 0)
   - Number of washrooms/bathrooms
   - Each adds 0.08 to touchpoint score (capped at 0.32 for 4+ washrooms)

5. **`num_treatment_rooms`** (number, default: 0)
   - Number of treatment/patient rooms
   - Each adds 0.05 to touchpoint score (capped at 0.25 for 5+ rooms)

6. **`has_reception`** (boolean, default: false)
   - Has reception/waiting area
   - Adds 0.06 to touchpoint score

7. **`has_kitchen`** (boolean, default: false)
   - Has kitchen/break area
   - Adds 0.06 to touchpoint score

8. **`flooring`** (string, default: 'mostly_hard')
   - Options: `mostly_hard`, `mixed`, `mostly_carpet`
   - Complexity factor: 0.00, 0.06, 0.10 respectively

9. **`after_hours_required`** (boolean, default: false)
   - Service required after business hours
   - Adds 0.08 to complexity score

10. **`supplies_included`** (boolean, default: true)
    - Cleaning supplies included in price
    - Adds 0.06 to complexity score

11. **`high_touch_disinfection`** (boolean, default: auto)
    - High-touch surface disinfection
    - Default: `true` for healthcare (medical_clinic, dental, physio_chiro, optical)
    - Default: `false` for commercial_office, industrial, residential_common_area
    - Adds 0.08 to touchpoint score

12. **`urgency_start_days`** (number, default: 30)
    - Days until service start (urgency indicator)
    - 0-2 days: +0.10 complexity (urgent)
    - 3-7 days: +0.05 complexity (moderate)
    - 8+ days: +0.00 complexity (normal)

13. **`notes`** (string, default: '')
    - Additional notes
    - If contains keywords: 'construction dust', 'biohazard', 'flood', 'mold' → requires walkthrough

---

## 💰 BASE PRICES (Monthly, Ex-HST)

Base prices represent monthly cost for **4 visits/month** in **1201-1600 sqft** band (baseline):

| Service Type | Base Price | Minimum Floor |
|-------------|------------|---------------|
| `commercial_office` | $349 | $349 |
| `physio_chiro` | $579 | $579 |
| `medical_clinic` | $649 | $649 |
| `dental` | $699 | $699 |
| `optical` | $599 | $599 |
| `industrial` | $799 | $799 |
| `residential_common_area` | $499 | $499 |

**Note:** These are baseline prices. Final price is multiplied by multiple factors (see calculation formula below).

---

## 📐 SQUARE FOOTAGE BANDS

Square footage determines a **multiplier** applied to base price. Bands are **not per-sqft pricing** - they're tiered ranges:

| Band | Sqft Range | Multiplier | Walkthrough Required |
|------|------------|------------|---------------------|
| **band_1** | 0-1,200 | 0.92 | No |
| **band_2** | 1,201-1,600 | 1.00 (baseline) | No |
| **band_3** | 1,601-2,000 | 1.14 | No |
| **band_4** | 2,001-2,600 | 1.32 | **Yes** |
| **band_5** | 2,601-3,500 | 1.55 | **Yes** |
| **band_6** | 3,501+ | Custom only | **Yes** |

**Example:**
- 1,500 sqft → band_2 → 1.00x multiplier
- 1,800 sqft → band_3 → 1.14x multiplier (14% more than baseline)
- 2,400 sqft → band_4 → 1.32x multiplier (32% more than baseline, requires walkthrough)

---

## 🔄 FREQUENCY MULTIPLIERS (Non-Linear)

Frequency determines how many visits per month. Higher frequency = higher monthly total, but **not linear** (discounts for volume):

| Max Visits/Month | Multiplier | Description |
|-----------------|------------|-------------|
| ≤ 4 | 1.00 | Weekly (baseline) |
| 5-8 | 1.80 | 2x per week |
| 9-12 | 2.45 | 3x per week |
| 13-16 | 3.05 | 4x per week |
| 17-20 | 3.70 | 5x per week |
| 21+ | Custom only | Requires walkthrough |

**Example:**
- 4 visits/month → 1.00x (baseline)
- 8 visits/month → 1.80x (not 2.0x - there's a 10% volume discount)
- 12 visits/month → 2.45x (not 3.0x - there's an 18% volume discount)

**Note:** These multipliers represent **total monthly price**, not per-visit price.

---

## 🎯 TOUCHPOINT DENSITY SCORING

Touchpoints are high-traffic areas that require extra attention. Each touchpoint **adds to a score**, which becomes a **multiplier**:

### Touchpoint Scores (Additive)
- **Washroom**: +0.08 per washroom (capped at 0.32 for 4+ washrooms)
- **Treatment Room**: +0.05 per room (capped at 0.25 for 5+ rooms)
- **Reception**: +0.06 (if has_reception = true)
- **Kitchen**: +0.06 (if has_kitchen = true)
- **High-Touch Disinfection**: +0.08 (if high_touch_disinfection = true)

### Touchpoint Multiplier Calculation
```
touchpoint_score = sum(all touchpoint scores, capped at 0.45)
touchpoint_multiplier = 1 + touchpoint_score
```

**Examples:**
- 2 washrooms + kitchen + reception + high-touch = 0.08×2 + 0.06 + 0.06 + 0.08 = 0.36
- Multiplier = 1 + 0.36 = **1.36x** (36% premium)
- 5 washrooms (capped at 0.32) + 6 treatment rooms (capped at 0.25) = 0.57 → **capped at 0.45**
- Multiplier = 1 + 0.45 = **1.45x** (45% premium - maximum)

---

## 🔧 COMPLEXITY FACTORS

Complexity factors represent additional challenges that increase price. Also **additive scoring**, converted to multiplier:

### Complexity Scores (Additive)
- **Flooring Type**:
  - `mostly_hard`: +0.00
  - `mixed`: +0.06
  - `mostly_carpet`: +0.10
- **After Hours**: +0.08 (if after_hours_required = true)
- **Supplies Included**: +0.06 (if supplies_included = true)
- **Urgency**:
  - 0-2 days: +0.10 (urgent)
  - 3-7 days: +0.05 (moderate)
  - 8+ days: +0.00 (normal)

### Complexity Multiplier Calculation
```
complexity_score = sum(all complexity factors, capped at 0.30)
complexity_multiplier = 1 + complexity_score
```

**Examples:**
- Mixed flooring + after hours + supplies = 0.06 + 0.08 + 0.06 = 0.20
- Multiplier = 1 + 0.20 = **1.20x** (20% premium)
- Carpet + after hours + supplies + urgent (0-2 days) = 0.10 + 0.08 + 0.06 + 0.10 = 0.34 → **capped at 0.30**
- Multiplier = 1 + 0.30 = **1.30x** (30% premium - maximum)

---

## 🧮 PRICING FORMULA

The final monthly price (ex-HST) is calculated as:

```javascript
// Step 1: Start with base price for service type
basePrice = QUOTE_CONFIG.basePrices[service_type]

// Step 2: Apply all multipliers
monthlyExHst = basePrice 
  × sqftBand.multiplier 
  × freqMultiplier.multiplier 
  × touchpointMultiplier 
  × complexityMultiplier

// Step 3: Apply minimum floor
monthlyExHst = max(monthlyExHst, minimumMonthly[service_type])

// Step 4: Round to nearest $10
monthlyExHst = round(monthlyExHst / 10) × 10

// Step 5: Calculate per-visit price
perVisitPrice = monthlyExHst / frequency_per_month
perVisitPrice = round(perVisitPrice / 5) × 5  // Round to nearest $5

// Step 6: Calculate HST (13% Ontario)
hstAmount = round(monthlyExHst × 0.13 × 100) / 100
monthlyIncHst = monthlyExHst + hstAmount
```

---

## 📊 CALCULATION EXAMPLE

### Example 1: Medical Clinic (Standard Setup)

**Inputs:**
- `service_type`: `medical_clinic`
- `sqft_estimate`: 1,800
- `frequency_per_month`: 4
- `num_washrooms`: 3
- `num_treatment_rooms`: 5
- `has_reception`: true
- `has_kitchen`: false
- `flooring`: `mostly_hard`
- `after_hours_required`: false
- `supplies_included`: true
- `high_touch_disinfection`: true (auto for medical)
- `urgency_start_days`: 14

**Calculation:**
1. Base price: **$649** (medical_clinic)
2. Sqft band: 1,800 → band_3 → multiplier: **1.14**
3. Frequency: 4 visits → multiplier: **1.00**
4. Touchpoints:
   - 3 washrooms: 3 × 0.08 = 0.24
   - 5 treatment rooms: 5 × 0.05 = 0.25 (capped, original is 0.25)
   - Reception: 0.06
   - High-touch: 0.08
   - Total: 0.24 + 0.25 + 0.06 + 0.08 = **0.63** → capped at **0.45**
   - Multiplier: 1 + 0.45 = **1.45**
5. Complexity:
   - Flooring (mostly_hard): 0.00
   - Supplies included: 0.06
   - Urgency (14 days = 8+): 0.00
   - Total: **0.06**
   - Multiplier: 1 + 0.06 = **1.06**

**Final Price:**
```
$649 × 1.14 × 1.00 × 1.45 × 1.06
= $649 × 1.75518
= $1,139.61
→ Round to nearest $10: $1,140
```

**Results:**
- Monthly (ex-HST): **$1,140**
- HST (13%): **$148.20**
- Monthly (inc-HST): **$1,288.20**
- Per-visit: $1,140 / 4 = $285 → rounded to **$285**

---

### Example 2: Commercial Office (Simple Setup)

**Inputs:**
- `service_type`: `commercial_office`
- `sqft_estimate`: 1,200
- `frequency_per_month`: 8
- `num_washrooms`: 2
- `num_treatment_rooms`: 0
- `has_reception`: true
- `has_kitchen`: true
- `flooring`: `mixed`
- `after_hours_required`: false
- `supplies_included`: true
- `high_touch_disinfection`: false
- `urgency_start_days`: 30

**Calculation:**
1. Base price: **$349** (commercial_office)
2. Sqft band: 1,200 → band_1 → multiplier: **0.92**
3. Frequency: 8 visits → multiplier: **1.80**
4. Touchpoints:
   - 2 washrooms: 2 × 0.08 = 0.16
   - Reception: 0.06
   - Kitchen: 0.06
   - Total: **0.28**
   - Multiplier: 1 + 0.28 = **1.28**
5. Complexity:
   - Flooring (mixed): 0.06
   - Supplies included: 0.06
   - Urgency (30 days = 8+): 0.00
   - Total: **0.12**
   - Multiplier: 1 + 0.12 = **1.12**

**Final Price:**
```
$349 × 0.92 × 1.80 × 1.28 × 1.12
= $349 × 2.370432
= $827.28
→ Round to nearest $10: $830
→ Apply minimum floor: max($830, $349) = $830
```

**Results:**
- Monthly (ex-HST): **$830**
- HST (13%): **$107.90**
- Monthly (inc-HST): **$937.90**
- Per-visit: $830 / 8 = $103.75 → rounded to **$105**

---

## 🚫 WALKTHROUGH REQUIREMENTS

A walkthrough is **required** (quote cannot be sent automatically) if:

1. **Square footage** exceeds band_3 (2,000 sqft) → band_4+ requires walkthrough
2. **Frequency** exceeds 20 visits/month → custom pricing needed
3. **Service type** is `industrial` → always requires walkthrough
4. **Treatment rooms** exceed 8 → requires walkthrough
5. **Notes** contain keywords: 'construction dust', 'biohazard', 'flood', 'mold'

If walkthrough is required:
- Quote system shows "Walkthrough Required" message
- User must book a walkthrough appointment
- System sends welcome email with booking details
- No automatic quote is generated

---

## 📦 LINE ITEMS BREAKDOWN

The quote engine generates **line items** for transparency:

1. **Base Service**
   - Amount: `basePrice × sqftBand.multiplier × freqMultiplier`
   - Description: Service type + sqft band label

2. **Touchpoint Density Premium** (if touchpointScore > 0)
   - Amount: `baseServiceAmount × (touchpointMultiplier - 1)`
   - Description: Lists all touchpoints (washrooms, rooms, reception, kitchen, high-touch)

3. **Complexity Premium** (if complexityScore > 0)
   - Amount: `baseServiceAmount × touchpointMultiplier × (complexityMultiplier - 1)`
   - Description: Lists complexity factors (flooring, after hours, supplies, urgency)

---

## ✅ ASSUMPTIONS & CAPS

The quote engine includes **cap language** and **assumptions**:

### Cap Language
- Square footage is capped at the **band maximum** (not exact sqft)
- Example: If 2,100 sqft entered → quotes for **band_4 maximum (2,600 sqft)**

### Assumptions
- Supplies included: `supplies_included` boolean
- Healthcare disinfection: Auto-enabled for healthcare services
- Estimation required: `true` if sqft is null or 0

### Minimum Floors
- Each service type has a **minimum monthly price**
- If calculated price is below minimum, **minimum is applied**
- Minimums match base prices (no discounting below baseline)

---

## 🔍 DEBUGGING & VALIDATION

The quote engine returns a `calculation_breakdown` object with all intermediate values:

```javascript
{
  base_price: 649,
  sqft_band_multiplier: 1.14,
  frequency_multiplier: 1.00,
  touchpoint_multiplier: 1.45,
  complexity_multiplier: 1.06,
  touchpoint_score: 0.45,
  complexity_score: 0.06
}
```

This allows you to verify each step of the calculation.

---

## 📝 SUMMARY

**The quote engine is NOT per-sqft pricing.** Instead, it uses:
1. **Tiered sqft bands** (like insurance brackets)
2. **Non-linear frequency multipliers** (volume discounts)
3. **Additive touchpoint scoring** (converted to multiplier)
4. **Additive complexity scoring** (converted to multiplier)
5. **Multiplicative formula** (all factors multiply together)
6. **Minimum floors** (no pricing below baseline)
7. **Rounding rules** (monthly to $10, per-visit to $5)

This creates **defensible, consistent pricing** that scales with complexity without being overly simplistic or overly complex.
