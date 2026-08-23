# Small quantities for מדבקות (under 100 units)

## What happens today

The sticker anchors only cover packages of 100 / 150 / 200 / 250 / 500. Anything under 100 is an extrapolation of that ladder, and it breaks down:

- 14×11, qty 1 → ₪100 ("מתחת לעוגן הקטן — מחיר העוגן")
- 14×11, qty 10 → ₪92 (cheaper than one piece)
- 14×11, qty 22 → ₪112

Ten stickers cost less than one. The setup + decaying-unit curve fitted from the 100–500 ladder is being run backwards into a range it was never fitted for, and nothing enforces that price grows with quantity.

## Suggested approach

Treat everything below the smallest anchored package as its own short-run zone, driven by the same print reality: a short run is one sheet, so it costs almost the same as the smallest package.

Three rules, in order:

1. **Short-run floor.** Below the smallest anchored quantity (100), the price starts at a configurable share of the 100-unit price for that size. Default 70%. So 14×11 at 100 units = ₪115 → any run of 1–~30 units lands at ₪80.
2. **Straight ramp up to the first anchor.** Between the short-run floor and the 100-unit anchor price the price rises linearly with quantity, so 1 unit = the floor, 100 units = the exact anchor price, and everything in between is a smooth climb. Per-unit price therefore falls continuously as the run grows, which is the correct shape.
3. **Monotone guard on quantity.** A suggestion can never be lower than the suggestion for a smaller quantity of the same size. This is a hard clamp applied after the curve, so no future anchor combination can reproduce the "10 costs less than 1" result.

With 14×11 (100 units = ₪115, floor 70% = ₪80):

| qty | price | per unit |
| --- | --- | --- |
| 1 | 80 | 80 |
| 10 | 83 | 8.3 |
| 22 | 88 | 4.0 |
| 50 | 97 | 1.94 |
| 100 | 115 | 1.15 |

Above 100 nothing changes — the existing anchor ladder keeps driving the price.

## Config

The family advanced settings gain one field for sheet families:

- **מחיר מינימום לריצה קצרה (% ממחיר 100)** — default 70%, admin-editable, stored per family.

Leaving it at 100% makes any quantity under a package simply cost the package price, which is the other legitimate business policy (minimum order = one package). Setting it lower gives the ramp above.

## Calculator display

For a quantity below the smallest package, the breakdown line reads, for example:
`ריצה קצרה · 22 יח׳ · מינימום ₪80 (70% ממחיר 100 יח׳) → ₪88 · ₪4.00 ליחידה`

The package chips (100/150/200/250/500) stay as they are; typing a free quantity under 100 now gets this treatment.

## Technical notes

- `src/lib/mdvd.ts`
  - `FamilyPricing` gains `shortRunPct` (read/write from `pricing_config.v3.short_run_pct`, default 0.7).
  - In the sheet branch of `priceJob`, before the setup/marginal and qty-curve paths: when `units < minAnchorQty` for the family, compute `p100 = ` price of the same size at the smallest anchored quantity (exact anchor if present, otherwise the existing size curve at that quantity), then
    `price = p100 × (shortRunPct + (1 − shortRunPct) × (units − 1) / (minAnchorQty − 1))`.
  - After every sheet-branch return, apply a monotone-in-quantity clamp: recompute the price at `units − 1` (cheap, same closed form) and take the max. Implemented as a helper so it covers all sheet paths, not just the short-run one.
  - `anchorFloor` keeps its current role for size monotonicity.
- `src/routes/calculator.tsx` — add the short-run percentage field to the sheet-family config group (inside the existing `fieldset disabled={!isAdmin}`), and render the new breakdown string.
- No schema change; `pricing_config` already stores the v3 block.
