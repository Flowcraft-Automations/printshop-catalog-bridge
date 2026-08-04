# Anchor-based pricing for the size calculator

Replace the rate-per-m² formula with interpolation over real catalog prices in the selected family.

## How pricing will work

1. **Anchors** — every product in the family with qty = 1 and a price (`final_price` when set, otherwise `senzey_price`). Area = width × height / 10000. Products missing width, height or price are ignored. Duplicate areas collapse to one anchor: prefer the row with `final_price`, otherwise the cheapest.
2. **Monotonic cleanup** — anchors sorted by area ascending; any anchor cheaper than the last kept one is dropped as an anomaly. The count is shown quietly as "דילגנו על X חריגות".
3. **Lookup for the requested size**
   - Area within ±2% of an anchor → that anchor's price, label "מחיר קטלוג" (returned as-is, no rounding).
   - Below the smallest anchor → smallest anchor's price, label "מחיר מינימלי — המידה הקטנה במחירון".
   - Between two anchors → linear interpolation on area, with "מחושב בין {מידה א} = {מחיר א} לבין {מידה ב} = {מחיר ב}".
   - Above the largest anchor → extrapolate along the slope of the final segment, warning label "מעבר למידה הגדולה במחירון — לבדיקה ידנית".
4. **Adjustments** — apply `min_charge` as a floor, then the family's quantity-discount multiplier as today, then round to the nearest 5 ₪. Exact catalog matches skip rounding.
5. **Fallback** — a family with no usable anchors keeps the current `rate_m2` × area formula (labelled as such).

## UI changes

- The formula breakdown block is replaced by a short plain-language explanation: which anchors were used, the interpolation sentence, the anomaly-skip note, and any min-charge/discount/rounding adjustments that actually applied.
- Unit price, total, the "צור מוצר מהחישוב" button, the similar-products table and the family pricing-curve admin table stay unchanged.

## Technical notes

- New pure functions in `src/lib/mdvd.ts`: `buildAnchors(products, family)` and `priceFromAnchors(anchors, family, w, h, qty)` returning `{ unit, total, basis, label, anchorsUsed, skipped, mult, minApplied, rounded }`. `computePrice` stays for the fallback path.
- `src/routes/calculator.tsx` calls the new functions with the already-loaded products/families queries; no data-layer or schema changes.
