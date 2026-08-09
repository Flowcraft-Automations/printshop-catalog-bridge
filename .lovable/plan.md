# Anchor curve: switch from a straight line to a power curve

## Why

The שמשונית family has three pinned anchors: 30/30 = ₪60, 120/80 = ₪120, 150/150 = ₪160. Today the curve is a least-squares straight line over them (`base + rate × area`), which does two bad things:

- It does not pass through the anchors you pinned — the anchor prices themselves get "corrected" by the fit.
- A straight line forces a large fixed base (~₪64 here), so tiny sizes look expensive and huge sizes look cheap per m².

Print pricing scales sub-linearly with area, so the standard model is a power curve: `price = a × area^b`, with `b` typically between 0.4 and 0.8.

## New behaviour

1. **Anchors are exact.** Any pinned anchor prices at its own catalog price, always.
2. **Between two anchors** — geometric (log-log) interpolation, i.e. a power curve fitted through exactly those two neighbours. Every anchor is hit exactly and the curve is smooth.
3. **Below the smallest / above the largest anchor** — extend the nearest segment's exponent. With a single anchor, use the family exponent (default 0.6) instead of pure proportionality.
4. **Bundle quantity** — unchanged: the existing `(qty / 1000)^c` volume factor still applies on top.
5. **Minimum charge, cheapest-anchor floor, round-to-5, exact catalog-size/quantity match** — all unchanged.
6. **No pinned anchors** — unchanged fallback: fit from all family items, but as a power curve rather than a line.

With this, 45/35 in שמשונית prices at ≈ ₪70 (interpolated between the 30/30 and 120/80 anchors with exponent ≈ 0.29), and 30/30 stays exactly ₪60.

## Display changes

- The calculator breakdown says which two anchors the price sits between and the exponent used, instead of "base + rate per cm²".
- The family curve panel shows `a`, `b` and the average deviation instead of base/rate.
- `CurveChart` draws the curve as a smooth power line through the anchors instead of a straight line.

## Technical notes

- `src/lib/mdvd.ts`: add `fitPowerCurve(anchors)` returning `{ a, b, deviation, count }` (least squares on log area vs log refPrice, `b` clamped to 0.3–1.0), and `priceFromCurve(...)` which does the piecewise log interpolation between neighbouring anchors and falls back to the global `a × area^b` outside the anchor range or when fewer than 2 anchors exist. `fitFamilyLine` / `priceFromLine` stay for the no-anchor legacy path until the new path is verified, then are removed.
- `src/routes/calculator.tsx` and `src/routes/catalog.tsx` (`curveByProduct` memo) both call the new functions; pinned items keep their current-price shortcut.
- `src/components/CurveChart.tsx` samples the curve at ~40 points across the area range instead of drawing two endpoints.
- No schema change; `families.base_price` / `rate_m2` stay unused.
