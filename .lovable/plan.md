# Fix פליירים price growth + add חד צדדי / דו צדדי

## What's wrong today (verified)

פליירים has exactly one verified anchor — 15×10 · 100 יח׳ = ₪116 — and the family's
מקדם כמות is 80%. Every larger quantity is extrapolated from that single point:

```text
100 יח׳   ₪116   (anchor)
300 יח׳   ₪279   engine   vs ₪232 real
1000 יח׳  ₪732   engine   vs ₪348 real
5000 יח׳  ₪2,652 engine   vs ₪1,093 real
```

The real Senzey ladder implies an exponent near 0.50, not 0.80, so the curve grows
roughly 2× too fast on large runs.

## Change 1 — quantity growth follows the real ladder

- Fit the family's quantity exponent from its own price ladder for the same size,
  then store it as פליירים's מקדם כמות (≈0.50 instead of 0.80). Result:
  300 ≈ ₪230, 1000 ≈ ₪350, 5000 ≈ ₪1,100.
- Mark the key quantity steps of 15×10 (300, 1000, 5000) as verified anchors so the
  curve is pinned to real prices at each step instead of extrapolated from one point,
  and quantities in between interpolate along the ladder.
- The engine keeps its current order: exact size+quantity anchor wins verbatim, then
  the anchor ladder, then exponent extrapolation, then floors and rounding.
- Clean up the ladder rows that contradict it (15/21: 400 יח׳ = ₪232 and 500 יח׳ = ₪220
  are below the 300 יח׳ = ₪348 row) — they stay unverified so they never feed pricing,
  and appear in the existing "עוגנים סותרים" warning if flagged as anchors.

## Change 2 — sides (חד צדדי / דו צדדי)

- New per-family setting: **תוספת דו צדדי** — a multiplier (default 1.2 for פליירים,
  1.0 elsewhere, so nothing else changes).
- New per-item field on catalog products: **צדדים** — חד צדדי (default) or דו צדדי.
  Existing rows named "דו או חד צדדי" stay at the default until you set them.
- Calculator gets a two-button toggle next to quantity: חד צדדי / דו צדדי. Choosing
  דו צדדי multiplies the suggested price by the family factor, and the breakdown adds
  a line "דו צדדי × 1.2".
- Anchors are matched by side too: a דו צדדי request first looks for a verified
  דו צדדי anchor of that size+quantity; when none exists it falls back to the
  חד צדדי curve × the factor.
- Catalog gets the צדדים column (sortable, filterable, in the column chooser and the
  export), and the field is editable in the edit drawer.

## Technical notes

- Migration: add `sides text not null default 'single'` to `products` with a check
  constraint of `single`/`double`; grants and RLS unchanged.
- `src/lib/mdvd.ts`: `FamilyPricing` gains `doubleSideFactor` (`double_side_factor`
  in `pricing_config.v3`, default 1); `priceJob` takes a `sides` argument, filters
  anchors by side, and applies the factor before cost floors and rounding.
- Data update for פליירים only: `qty_exponent` set to the fitted value and
  `double_side_factor` = 1.2; verify + anchor the 15×10 ladder rows.
- `src/routes/calculator.tsx`: side toggle, breakdown line, the new family field in
  advanced settings (admin-only, as today).
- `src/routes/catalog.tsx`: new `sides` column + drawer field.
