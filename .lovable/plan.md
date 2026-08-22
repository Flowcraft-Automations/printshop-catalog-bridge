# Use the global fitted curve above the largest anchor

## Why

50/75 (0.375 m²) sits above every קנבס anchor. Today the engine continues from the single largest anchor, 30/120 = ₪180 at 0.36 m², giving ₪185 — even though 50/70 = ₪155 at 0.35 m². The two anchors disagree (₪443/m² vs ₪500/m²), and the narrow one wins purely because it is last.

## Change

Above the largest anchor, price from the power curve fitted through **all** the family anchors instead of continuing from the last one:

```text
price = a x area^b     (least squares over every anchor, b clamped 0.3-1.0)
```

For קנבס the fit is a = 276, b = 0.47, so 50/75 prices at ≈ ₪175 (rounded per family rounding), and larger sizes keep following the same smooth trend rather than inheriting the narrow-shape rate.

Unchanged:

1. Exact anchor match (±2%) still returns the anchor's own price, untouched.
2. Between two anchors, log-log interpolation through those two neighbours, so the curve passes exactly through every anchor.
3. Below the smallest anchor, the smallest anchor's price is the floor.
4. The result is never below the largest anchor's price — if the global fit reads lower than the last anchor (as here: 171 vs 180 at 0.36 m²), the largest anchor's price acts as a floor and the curve is shifted up to meet it, so growth stays monotonic and no big size is quoted below a smaller one.
5. Validated catalog prices, the outsourcing threshold branch, sheet method, quantity factor, cost floor and rounding all behave exactly as today.

## Where you will see it

- Calculator breakdown for above-anchor sizes says the price came from the family curve, with the fitted exponent.
- Catalog "מחיר לפי עקומה" and "סטייה מהעקומה" recalculate for every item larger than its family's biggest anchor.

## Technical notes

- `src/lib/mdvd.ts`, `areaCurvePrice`: replace the `area >= last.area` branch (currently `last.price x (area / last.area)^b` from the last segment) with `global.a x area^b`, floored at `last.price` and scaled so the curve is continuous at `last.area`. Keep `fitPowerCurve` as is; fall back to the current last-anchor continuation when fewer than two anchors make a fit impossible.
- No other file changes, no schema change.
