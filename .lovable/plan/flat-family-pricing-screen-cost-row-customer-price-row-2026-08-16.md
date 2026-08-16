# Flat family pricing screen: cost row + customer-price row

The family settings at the bottom of the calculator become three flat rows of labeled number fields, in the exact style of the existing עלות ייצור למשפחה block — no cards, no wizard, no tabs, no tier editor.

## The screen (admin only, per selected family)

**Row 1 — עלות ייצור למשפחה** (unchanged, already correct)
₪ למ״ר · סף רוחב (ס״מ) · סף גובה (ס״מ) · ₪ למ״ר במיקור חוץ (מעל הסף) · מקדם תקורה

**Row 2 — מחיר ללקוח למשפחה** (new, same flat style)
דמי בסיס ₪ · ₪ למ״ר ללקוח · מחיר מינימום ₪ ‖ ומעל הסף: דמי בסיס ₪ · ₪ למ״ר ללקוח · מחיר מינימום ₪

A collapsed link **אפשרויות נוספות** holds only two things:
- מינימום למטר אורך ₪ — for ribbon-shaped products
- מצב גיליון toggle — when on, the below-threshold fields relabel to דמי הכנה ₪ · מחיר לגיליון ₪ · עלות גיליון ₪ · יחידות בגיליון, with a small per-size override list (size → units per sheet)

**Row 3 — shared** (kept): עיגול מחיר · הנחות כמות · the שמור buttons.

Below the rows, one compact **בדיקה מהירה** box: width / height / quantity → resulting price and which side of the threshold it landed on.

## Pricing rules

- Threshold means "fits in the box": longer side ≤ סף רוחב **and** shorter side ≤ סף גובה → below-threshold numbers; otherwise the above-threshold set.
- Price = דמי בסיס + ₪ למ״ר × שטח, never below מחיר מינימום, and never below מינימום למטר אורך × length in meters when that field is set.
- Sheet mode (below threshold only): price = דמי הכנה + sheets needed × מחיר לגיליון, where sheets come from יחידות בגיליון (or the per-size override).
- Quantity scaling and rounding keep working as today, applied after the base calculation.
- The below-floor warning compares against the cost side that matches the same threshold decision × מקדם תקורה.

## Seeds and verification

- שמשונית: box 9999×160 (banner length is unlimited, only height is roll-bound). 120×80 → 70, 400×200 → 800, 200×40 → 110 (driven by the linear-meter minimum).
- מדבקות: box 20×20. 5×5 ×100 → 126, ×500 → 230, 30×30 → at least 70.
- Empty size input shows הזינו מידות instead of a price.

Family parameters are fitted to hit these targets and stored as the seeded values; each case is checked in the quick-test box after the change.

## Technical notes

- `families.pricing_config` (JSON) stays the storage format and keeps its current shape; this screen reads and writes it. The two threshold sides are stored as the two entries the engine already expects, with `base`, `rate_m2`, `min`, plus optional `min_per_linear_m` and a `sheet` object (`setup`, `price_per_sheet`, `cost_per_sheet`, `units_per_sheet`, `overrides`).
- New pure functions in `src/lib/mdvd.ts`: `fitsInBox(w, h, family)` and `priceFromConfig(family, w, h, qty)` returning `{ total, side, minApplied, linearApplied, sheets }`. The existing anchor/power-curve path, `jobCost` and `costFloor` are untouched; the configured price takes precedence when the family has customer-price values set.
- `src/routes/calculator.tsx`: add the Row 2 field group, the אפשרויות נוספות disclosure, Row 3 (rounding + quantity discount + save), and the בדיקה מהירה box; remove any tier-editor markup. All fields stay admin-only, matching the current block.
- One data migration updates the שמשונית and מדבקות rows with the fitted values above; no schema change.
