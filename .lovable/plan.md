# Fix the calculator pricing order

The calculator currently prices every job from anchors only. Validated catalog prices are ignored, the quantity factor is applied only above the outsourcing threshold, and below-threshold prices scale strictly linearly with quantity. This changes the engine to a clear three-step order.

## Pricing order

1. **Validated price (highest priority)** — if the family has an item marked אומת with the exact same size and the exact same quantity, and it has a price, use that price as-is. No interpolation, no rounding, no margin. Label: "מחיר מאומת מהקטלוג".
2. **Anchors** — no exact validated match: price from the family anchors as today (exact anchor, interpolation between anchors, or continuation above the largest anchor).
3. **Cost fallback** — no usable anchors: cost per m² × area × margin, as today.

## Quantity factor

The quantity factor (מקדם כמות) applies in every branch except the validated price:

- anchor / interpolated / cost prices are computed per unit, then multiplied by `units^exponent` instead of `units`
- exponent 1 keeps today's linear behaviour; below 1 gives a quantity discount
- the breakdown line states the factor whenever it is not 1

## Outsourcing factor

Above the width/height threshold the job keeps the outsourcing path (outsource cost per m² × billed unit area with the minimum per unit × quantity factor × margin). Two fixes:

- a validated exact match still wins over the outsourcing calculation
- when the family has no outsourcing cost configured (as in שלטי PVC), the calculator says so explicitly instead of silently pricing at ₪0 production cost

## Breakdown clarity

The price card shows which of the three sources produced the number, plus the size, quantity, quantity factor and any threshold/minimum that applied — so a result like ₪700 for 60×40 × 10 can be traced back to its source in one glance.

## Technical notes

- `priceJob` in `src/lib/mdvd.ts` gains a validated-match lookup (passed in from the already loaded products list) that runs before the anchor logic, matching on family, normalized size key and quantity.
- The quantity factor moves out of the above-threshold branches into the shared `finish` step so all branches use `units^qtyExponent`.
- `src/routes/calculator.tsx` passes the family's products into `priceJob` and renders the new source label and breakdown; no schema changes.
