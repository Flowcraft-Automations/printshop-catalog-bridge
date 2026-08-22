# Softer pricing above the largest anchor

## Why 100×50 suggests ₪145

For שלטי PVC the anchors are 30×30 = ₪40 (0.09 m²), 30×90 = ₪90 (0.27 m²), 50×70 = ₪100 (0.35 m²).
Both 100×40 (0.40 m²) and 100×50 (0.50 m²) are larger than the biggest anchor, so the engine
falls back to that anchor's flat rate of ₪286/m²:

```text
100×40 → 0.40 × 286 = 114.3 → ₪115
100×50 → 0.50 × 286 = 142.9 → ₪145
```

The result is exactly proportional to area (145/115 = 0.5/0.4). But your own anchors get cheaper
per m² as they grow (444 → 333 → 286 ₪/m²), and that discount stops abruptly above the last anchor.
That mismatch is what feels wrong.

## The change

Above the largest anchor, continue the discount trend instead of freezing the last rate.

- Fit a power curve `price = a × area^b` through **all** the family's consistent anchors
  (least squares on log(area) vs log(price)).
- Use that curve for any size above the largest anchor.
- Clamp `b` to the range 0.4–1.0 so a noisy anchor set can never make big items cheaper than
  small ones or explode upward.
- Fall back to today's flat ₪/m² rule when the family has fewer than 2 usable anchors.
- Interpolation *between* anchors and exact anchor matches stay exactly as they are.

For שלטי PVC this fit gives b ≈ 0.69:

```text
100×40 → ₪115  (unchanged)
100×50 → ₪135  (was ₪145)
```

The explanation line under the price will read "מעל העוגן הגדול — לפי עקומת העוגנים" so it is
clear which rule produced the number.

## Technical notes

- Single change in `src/lib/mdvd.ts`, in the `area` branch of `priceJob` where
  `area > largest.area`: replace `rate = largest.price / largest.area` with the fitted power curve.
- Cost floor, rounding, quantity multiplication and the sheet method are untouched.
- No schema or data changes; the curve chart in the calculator picks up the new shape automatically
  since it calls the same engine.
