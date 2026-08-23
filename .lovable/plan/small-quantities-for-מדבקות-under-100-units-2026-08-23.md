# Small quantities for מדבקות (under 100 units)

## What happens today

The sticker anchors only cover packages of 100 / 150 / 200 / 250 / 500. Anything under 100 is an extrapolation of that ladder, and it breaks down:

- 14×11, qty 1 → ₪100 ("מתחת לעוגן הקטן — מחיר העוגן")
- 14×11, qty 10 → ₪92 (cheaper than one piece)
- 14×11, qty 22 → ₪112

Ten stickers cost less than one. The setup + decaying-unit curve fitted from the 100–500 ladder is being run backwards into a range it was never fitted for, and nothing enforces that price grows with quantity.

## Suggested approach — base by size, then a short-run ramp

Two steps, exactly as you described:

**Step 1 — base price for the size.** Take the 100-unit price for that size from the anchored ladder. If the size matches an anchor, that price is used verbatim; otherwise the existing size curve (built from the 100-unit anchors) gives it. 14×11 = 154 cm² lands in the top sticker bucket → base ₪187.

**Step 2 — short-run ramp.** Below the smallest anchored package (100), the price starts at a configurable share of the base — default 70% — and climbs linearly to the full base at 100 units:

```text
price = base × (0.70 + 0.30 × (qty − 1) / (100 − 1))
```

14×11, qty 22 → 187 × (0.70 + 0.30 × 0.212) = 187 × 0.764 = ₪142.8 → ₪143 (₪140 with rounding to fives). Per unit ≈ ₪6.50.

**Monotone guard.** A suggestion can never be lower than the suggestion for a smaller quantity of the same size — a hard clamp applied after the curve, so "10 costs less than 1" cannot come back.

Full ladder for 14×11 (base ₪187, floor 70% = ₪131):

| qty | price | per unit |
| --- | --- | --- |
| 1 | 131 | 131 |
| 10 | 136 | 13.6 |
| 22 | 143 | 6.50 |
| 50 | 159 | 3.18 |
| 100 | 187 | 1.87 |

Above 100 nothing changes — the existing anchor ladder keeps driving the price.


## Config

The family advanced settings gain one field for sheet families:

- **מחיר מינימום לריצה קצרה (% ממחיר 100)** — default 70%, admin-editable, stored per family.

Leaving it at 100% makes any quantity under a package simply cost the package price, which is the other legitimate business policy (minimum order = one package). Setting it lower gives the ramp above.

## Calculator display

For a quantity below the smallest package, the breakdown line reads, for example:
`ריצה קצרה · 22 יח׳ · בסיס ₪187 (100 יח׳) × 76% → ₪143 · ₪6.50 ליחידה`

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
