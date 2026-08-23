# Only verified items feed pricing — everywhere

## Verified cause of the 85×120 vs 120×80 case

שמשונית has two anchors for the same size 120×80, qty 1:

```text
120/80   ₪90   verified
120/80   ₪70   NOT verified
```

The engine merged them into one curve point at their average ₪80, so 85×120
(1.02 m²) interpolated from ₪80 up toward the 200×100 anchor (₪150) and landed at
₪84 — below the ₪90 of the smaller 120×80.

The unverified ₪70 row should never have been part of the calculation at all.

## The rule

**Unverified items are invisible to the pricing engine.** Everywhere, always:

1. Anchors: only products with `verified = true` are used to build any curve.
2. Exact-match "decided price" lookups in calculator and catalog: only verified rows
   can supply a price; an unverified row with the same size gets a suggestion like any
   other item.
3. Quantity-exponent fitting, monotonic floors, cost comparisons and the "nearest
   items" reference cards: all restricted to verified rows.
4. An unverified product flagged as anchor is simply ignored (no averaging, no
   conflict warning) until it is verified.

With this, 0.96 m² is ₪90, and 85×120 interpolates to ≈₪95 — above it, as expected.

Conflict handling stays only for genuine conflicts *between verified anchors*.

## Everything else unchanged

Thresholds/outsourcing, cost floor, margin, rounding, quantity handling and the
catalog UI all keep their current behaviour.

## Technical notes

- `src/lib/mdvd.ts`: filter to `verified` at the single point where product rows enter
  the anchor builder, and in the exact-match price lookup. Requires `verified` to be
  carried on the row type passed into `priceJob` (the callers already query it).
- `src/routes/calculator.tsx`: nearest-items and family reference tables already filter
  to verified; confirm and align the anchor list in advanced settings so it shows only
  verified anchors, with unverified anchor rows listed separately as "לא מאומת — לא
  משפיע על התמחור".
- `src/routes/catalog.tsx`: suggested-price and deviation columns pick this up
  automatically; the amber anchor marker on an unverified anchor becomes a grey
  "ignored" marker.
- No schema or data change.
