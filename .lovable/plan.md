# Base + rate linear pricing model

Replace anchor interpolation in the calculator with a fitted straight line per family: `price = base_price + rate_m2 × area`.

## Database

Add one column to `families`:
- `base_price` (number, default 0) — the fitted fixed component.

`rate_m2` already exists and will now hold the fitted slope. `min_charge`, `qty_discounts` and `notes` are unchanged.

## Fitting the line

1. **Anchors** — products in the family with qty = 1, a width, a height, and a price (`final_price` when set, otherwise `senzey_price`).
2. **Anomaly removal** — compute price per m² for each anchor, take the family median, and drop any anchor whose price per m² is more than 2.5× above or below that median. The dropped count is shown quietly.
3. **Regression** — simple least-squares fit of price against area over the remaining anchors, giving `base_price` and `rate_m2`. `base_price` is clamped to a minimum of 0 (with the slope refit through the origin if the clamp bites). A single usable anchor falls back to base 0 and rate = price / area.
4. **Fit quality** — average absolute % deviation between each anchor's real price and the fitted line. Above 15% the family shows the hint "המשפחה הזו מתאימה יותר לסולם מחירים קבוע".

Fitted values are only written to the database when the user presses the refit button; manual edits stick until the next refit.

## Pricing a requested size

1. Area within ±2% of a catalog anchor's area → that product's price exactly, labeled "מחיר קטלוג".
2. Otherwise `base_price + rate_m2 × area`, floored at the cheapest anchor's price (and at the family's `min_charge` when set), then quantity discount applied, then rounded to the nearest 5 ₪.

Breakdown text becomes: `מחיר בסיס {X} + {Y} למ״ר × {שטח} מ״ר = {סה״כ}`, plus the existing lines for the quantity discount, minimum floor, rounding, and skipped anomalies. The similar-products / family-items panel is untouched.

## Curve-management table

Columns become: משפחה · מחיר בסיס (editable) · ₪/מ״ר (editable) · מינימום · הנחות כמות · איכות התאמה · actions. Each row gets a "התאם מחדש מהנתונים" button that recomputes base and rate from that family's anchors, fills the inputs, and saves. Fit quality shows the average deviation %, in warning styling above 15% with the fixed-price-ladder hint.

## Technical notes

- `src/lib/mdvd.ts`: keep `buildAnchors` for the ±2% catalog match and cheapest-anchor floor, but swap its monotonic cleanup for the median price-per-m² filter. Add `fitFamilyLine(anchors)` → `{ base, rate, deviation, used, dropped }` and rewrite `priceFromAnchors` as `priceFromLine(family, anchors, w, h, qty)`.
- `src/routes/calculator.tsx`: use the new functions for the result panel, and extend `FamilyAdmin` / `FamilyRow` with the base-price field, fit-quality cell and refit button (writing `base_price` and `rate_m2` through the existing families update).
