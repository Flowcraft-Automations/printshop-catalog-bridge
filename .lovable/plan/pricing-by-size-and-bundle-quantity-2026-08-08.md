# Pricing by size AND bundle quantity

Today the curve only looks at size, and quantity is just a discount multiplier. That is wrong for families like פליירים, where 15×21 exists at 2000 / 3000 / 5000 units with very different prices. The curve becomes two-dimensional: size sets the base, quantity scales it with a volume-discount effect.

## The model

```text
price = (base + rate x area) x (quantity / 1000)^c
```

- `base + rate x area` is today's size line, but now expressed as the price for a reference bundle of 1,000 units.
- `c` is the family's volume-discount exponent. `c = 1` means no volume saving (double the quantity, double the price); `c = 0.7` means doubling the quantity costs about 62% more, i.e. the per-unit price drops as the run gets bigger. Real print pricing sits around 0.6-0.85.

## Where each piece comes from

**Volume exponent `c` — fitted family-wide, editable.**
Within a family, items are grouped by identical size. Every group with at least two different quantities gives one slope (log price against log quantity). The family's `c` is the median of those slopes, clamped to 0.3-1.0. Families with no such group default to 0.85. The calculator shows it as a plain sentence ("הכפלת הכמות מייקרת בכ־62%") with an editable field and a "התאם מהנתונים" button; a manual value sticks until refitted.

**Anchors — one per size, quantity-normalised.**
A pinned anchor keeps its own quantity. Before fitting the size line, each anchor's price is converted to the 1,000-unit reference using `c`. So pinning 15×21 @ 5000 = ₪780 tells the curve what that size costs at any quantity. Anchors at different quantities are therefore directly comparable, and items with qty 0 or missing size are still ignored.

**Fallback (no pinned anchors)** works the same way: all family items with a size, a price and a quantity are normalised to 1,000 units, then the ×2.5 median anomaly filter and the least-squares fit run on the normalised prices. This finally lets bundle items (qty 100, 2000, 5000...) participate — today they are silently dropped because only qty = 1 rows are used.

## Calculator changes

- Quantity now means "units in the job" and feeds the curve directly. The fitted price is the total for the job; the old per-unit × qty multiplication and the family `qty_discounts` tiers are removed from the result.
- The catalog ±2% exact-match shortcut also matches on quantity: same size *and* same quantity → that catalog price verbatim. Same size, different quantity → the price is scaled by the volume exponent, labelled "מחיר קטלוג מותאם לכמות".
- Breakdown text becomes: `מחיר ל-1000 יח׳ = בסיס X + Y לסמ״ר × שטח → מותאם ל-{qty} יח׳ (מקדם c) = סה״כ`, plus the minimum-charge and rounding lines.
- Curve chart is drawn at the currently requested quantity: every catalog point is scaled to that quantity so dots and the fitted line are comparable, with a note stating the quantity the chart represents. The item list gains a quantity column next to the suggested price.
- Experiment zone keeps working: overriding a price or a pin refits both the size line and (optionally) uses the same exponent, so you can see the effect across all quantities.

## Catalog changes

Suggested price and deviation % are computed at each item's own quantity, so a 5000-unit row is compared against the curve at 5000 units instead of being judged against a single-unit price. The "רק חריגים מהעקומה" filter and the אמץ button are unchanged otherwise.

## Technical notes

- Migration: add `qty_exponent numeric not null default 0.85` to `families`.
- `src/lib/mdvd.ts`:
  - `Anchor` gains `qty` and `refPrice` (price normalised to 1,000 units).
  - `fitQtyExponent(products, family)` → median log-log slope over same-size groups, clamped, with the sample count for display.
  - `buildAnchors(products, family, c)` drops the `qty === 1` restriction, keeps qty 0 / missing-size exclusions, and normalises before the median filter.
  - `fitFamilyLine` unchanged, but fits on `refPrice`.
  - `priceFromLine(..., w, h, qty, c)` applies `(qty/1000)^c`, handles the same-size/different-quantity catalog match, and drops the discount-tier branch.
- `src/routes/calculator.tsx`: exponent field + refit button, quantity-aware breakdown, chart scaling, item-list quantity column.
- `src/routes/catalog.tsx`: `curveByProduct` passes each product's quantity into the suggestion.
