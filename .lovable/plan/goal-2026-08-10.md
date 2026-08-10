Plan: Change outsourcing threshold from area to dimensions

## Goal
Make the outsourcing threshold a **size gate** (width × height) instead of a single m² area value. For שמשונית this means outsourcing starts when an item is **at least 150 cm wide AND at least 160 cm high**, not when area exceeds 2.4 m².

## Current state
- The `families` table has a single `outsource_area_m2` column.
- `jobCost()` decides "outsourced" when `area > outsource_area_m2`.
- The calculator shows "סף מיקור חוץ (מ״ר)" (m²).
- The catalog has a "מיקור חוץ" filter/column that is driven by area.
- The curve chart draws the threshold as a vertical line at the area value.

## What we will change

### 1. Database schema
Add two numeric columns to `public.families`:
- `outsource_width_cm` — width threshold in cm
- `outsource_height_cm` — height threshold in cm

Remove `outsource_area_m2` from the model (we will keep it in the database for now but stop reading/writing it, so we can later migrate data safely). No RLS changes are needed; the table already has an open policy.

### 2. Core pricing logic (`src/lib/mdvd.ts`)
- Update the `Family` type: replace `outsource_area_m2` with `outsource_width_cm` and `outsource_height_cm`.
- Update `JobCost` type: replace `threshold` with `thresholdW` and `thresholdH` (both `number | null`).
- Update `jobCost()`: a product is outsourced when `width >= thresholdW && height >= thresholdH` (and both thresholds and the outsource rate are positive).
- Keep `outsourced` boolean and `outsourceRate` in the returned object so the rest of the UI works unchanged.

### 3. Size calculator (`src/routes/calculator.tsx`)
- Replace the single "סף מיקור חוץ (מ״ר)" input with two inputs:
  - "סף רוחב (ס״מ)" → `outsource_width_cm`
  - "סף גובה (ס״מ)" → `outsource_height_cm`
- Update the family load/save mutations to use the new fields.
- Update the call to `jobCost()` to pass width and height.
- Update the `CurveChart` props to pass the two thresholds.

### 4. Catalog (`src/routes/catalog.tsx`)
- Update the per-product cost calculation to call `jobCost()` with width and height.
- Update the "מיקור חוץ" column filter: now checks `width >= thresholdW && height >= thresholdH`.
- Update the "רק מיקור חוץ" toolbar switch to use the new condition.
- Update the row threshold indicator and tooltip text.

### 5. Curve chart (`src/components/CurveChart.tsx`)
- Replace the single `outsourceArea` prop with `outsourceWidthCm` and `outsourceHeightCm`.
- The cost-floor line already calculates area point-by-point; we will switch each point to the outsourced rate when `area >= thresholdW*thresholdH/10000` so the curve still reflects the dimension gate in terms of area. This is the conservative approximation for a 2D chart.
- Remove or update the vertical threshold line label to describe the dimension gate (e.g., "מיקור חוץ מעל 150×160 ס״מ").

### 6. Data migration / default values
- For the existing `families` row(s), set default thresholds based on the known rule: 150 cm width and 160 cm height. If `outsource_area_m2` was previously set to 2.4, this matches the new dimensions, but the user can edit per family.

## Out of scope
- No change to the price-curve formula, anchor logic, or quantity exponent.
- No change to the overhead factor or business config.
- No change to RLS/auth.

## Acceptance criteria
- In the calculator, a 180×135 cm שמשונית is **not** marked as outsourced (135 < 160).
- In the calculator, a 180×160 cm or larger item **is** marked as outsourced and the cost floor uses the outsource rate.
- The catalog "מיקור חוץ" column and filter follow the same rule.
- The chart still shows a cost-floor line that jumps to the outsource rate beyond the dimension gate.
