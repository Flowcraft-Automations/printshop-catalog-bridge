# Fix pricing for sizes above the largest anchor

## What is happening now

קנבס anchors (area / price): 20/20 = ₪59, 20/30 = ₪71, 30/30 = ₪99, 30/45 = ₪105, 30/90 = ₪151, 50/70 = ₪155 (0.35 m²), 30/120 = ₪180 (0.36 m²).

50/75 is 0.375 m² — above the largest anchor — so the engine leaves interpolation and switches to a flat rate taken from the largest anchor alone: 180 / 0.36 = ₪500 per m², × 0.375 = 187.5, rounded up to ₪190. A 7% bigger sheet than 50/70 gets a 23% higher price, only because the reference switched from the 50/70 anchor to the 30/120 anchor's price per m².

That flat-rate rule is the bug: it assumes price is strictly proportional to area, which contradicts every other part of the curve (₪1,475/m² at 20×20 down to ₪443/m² at 50×70).

## The fix

Print pricing scales sub-linearly with area, so the anchors get fitted as a power curve instead:

```text
price = a x area^b        (b fitted from the anchors, clamped to 0.3-1.0)
```

1. **Anchors stay exact.** A requested size matching an anchor (±2%) prices at that anchor's own price — anchors are yours, never "corrected".
2. **Between two anchors** — log-log (geometric) interpolation between the two neighbouring anchors, so the curve passes exactly through both and bends the natural way.
3. **Above the largest anchor** — continue from the largest anchor using the exponent of the last segment (falling back to the globally fitted exponent when the last segment is degenerate, as here where 0.35 → 0.36 m² is nearly flat). For 50/75 this gives roughly ₪185 instead of ₪190, and, more importantly, sizes like 50/100 or 70/70 stop inheriting the narrow-shape rate.
4. **Below the smallest anchor** — unchanged: the smallest anchor's price is the floor.
5. **Monotonic guarantee** — the returned price is never lower than the price the engine gives for a smaller area in the same family.

Everything else is untouched: validated catalog prices still win first, the outsourcing threshold branch, sheet method, quantity factor, cost floor, minimum charge and rounding all behave exactly as today.

## Where you will see it

- Calculator breakdown states the two anchors used and the exponent, instead of "₪X per m² of the anchor".
- Catalog "מחיר לפי עקומה" and "סטייה מהעקומה" recalculate with the new continuation.
- Curve chart draws the smooth power curve through the anchors instead of the straight proportional ray.

## Technical notes

- `src/lib/mdvd.ts`: replace the `area > largest.area` proportional branch and the linear `interpolate` call in the area method with `fitPowerCurve(kept)` → `{ a, b }` (least squares on log area vs log price, `b` clamped 0.3-1.0) and a piecewise log-log lookup. `interpolate` stays for the sheet-method quantity axis.
- Exact-anchor match, `consistentAreaAnchors` cleanup, `finish()` rounding and all `source` labels are unchanged, so `src/routes/calculator.tsx` and `src/routes/catalog.tsx` need only the new breakdown wording.
- `src/components/CurveChart.tsx` samples the fitted curve at ~40 points across the area range.
- No schema change.
