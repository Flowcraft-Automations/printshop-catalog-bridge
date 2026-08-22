# Consistent suggested prices: add a shape factor

## What's wrong today

Prices are suggested from area alone. In קנבס the anchors themselves disagree by shape:

```text
50/70   0.350 m²   ₪155 anchor   →  ₪443 / m²
30/120  0.360 m²   ₪180 anchor   →  ₪500 / m²
```

A 3% bigger item jumps 16% in price, and everything just above 0.36 m² inherits the
expensive narrow-format rate: 50/75 → ₪185, 50/80 → ₪190, 40/120 → ₪210 while
60/80 (bigger) sits at ₪210 too. The long/narrow formats really are pricier to produce,
so the answer is not to delete an anchor — it is to let the engine know about shape.

## The fix

Price becomes a function of two things instead of one:

- **area** (m²) — as today
- **shape** — the aspect ratio `long side / short side` (1.0 = square, 4.0 = 30×120)

For each family, both exponents are fitted from that family's own anchors:

```text
price = a × area^b × aspect^c
```

- `b` — how price grows with size (already fitted today, typically ~0.5–0.7)
- `c` — the shape premium, fitted from the anchors. If a family's anchors show no
  shape effect, `c` comes out near 0 and behaviour is unchanged.

With the קנבס anchors this separates the two regimes: 50/70 (aspect 1.4) and
30/120 (aspect 4.0) both land on the same surface, so 50/75 (aspect 1.5) is priced
next to 50/70 (~₪160) instead of next to 30/120 (₪185).

Rules kept as-is:

- An exact anchor size always returns its exact anchor price, unrounded.
- Prices never drop as area grows at a fixed shape (monotonic floor kept).
- Quantity factor, threshold/outsourcing costs, margin, cost floor and rounding all
  apply on top exactly as they do now.

## Guardrails

- `c` is fitted only when the family has at least 4 anchors spanning at least two
  distinct aspect ratios; otherwise `c = 0` (pure area curve, today's behaviour).
- `c` is clamped to a sane range (0 to ~0.6) so one odd anchor cannot invert pricing.
- Aspect is clamped at 6 so extreme banners don't explode.

## Where it shows up

- Calculator: the price breakdown line gains the shape term, e.g.
  `0.375 מ״ר · יחס צורה 1.5 · מעריך שטח 0.55 · מעריך צורה 0.28`.
- Catalog suggested-price column and the adopt (אמץ) flow use the same engine, so
  suggestions become consistent there automatically.
- Curve chart: the drawn curve is the curve for the current item's aspect ratio,
  with anchors plotted as today.

## Scope

All families that price by area. Sheet-method families (stickers) keep their
per-sheet logic; the shape factor applies to their above-threshold area branch only.

## Technical notes

- `src/lib/mdvd.ts`: replace `fitPowerCurve` / `areaCurvePrice` with a two-variable
  log-log least-squares fit (`log p = log a + b·log area + c·log aspect`), including
  the degenerate fallbacks above. `priceJob` passes `w`/`h` through so aspect is known.
- No database changes — nothing new to configure, the exponents are derived from the
  anchors already stored on products.
- `src/routes/calculator.tsx`, `src/routes/catalog.tsx`, `src/components/CurveChart.tsx`
  updated to display the new detail string and curve.
