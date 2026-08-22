# Quantity must drive the price for מדבקות

## What's wrong today

Sheet families price a job by converting the quantity to "sheets" and interpolating
one shared curve built from every anchor of the family, regardless of size. All the
sticker anchors land in a narrow sheets range, so the curve is almost flat and the
quantity barely moves the price.

For 3×3 stickers (auto 117 units per sheet) the suggested prices come out
115 / 122 / 125 / 125 / 135 for 100 / 150 / 200 / 250 / 500 units, while the real
catalog prices are 115 / 122 / 134 / 150 / 210. The 250-unit job is suggested at the
same price as the 200-unit job — that is the bug.

## The new model for sheet families

Price becomes an explicit function of both size and quantity, the same idea already
used for area families:

```text
price = a × area^b × quantity^e
```

- `area` — the single sticker's area (m²)
- `quantity` — units in the job
- `e` — the quantity exponent: how price grows with run length
  (e = 1 → linear, e = 0.37 → 5× the quantity costs ~1.8× more)
- `b` — how price grows with sticker size

Both `a`, `b`, `e` are fitted by least squares in log space from the family's own
anchors. Guardrails:

- `e` is fitted only when the anchors cover at least two different quantities;
  otherwise `e` falls back to the family's configured מקדם כמות.
- `e` is clamped to 0.2–1.0, `b` to 0–1, so one odd anchor cannot invert pricing.
- An exact anchor (same size **and** same quantity) always returns its exact price,
  unrounded, as today.
- Validated catalog prices still win over everything, above-threshold outsourcing,
  cost floor, margin and rounding are unchanged.

With the current מדבקות anchors (3×3 @100 = ₪115, 3×3 @150 = ₪122,
5×5 @100 = ₪126, 5×5 @500 = ₪230) the fit gives roughly e ≈ 0.35, so 3×3 lands near
115 / 128 / 147 / 158 / 205 instead of the flat 115 / 122 / 125 / 125 / 135 —
prices that finally rise with the package.

## Manual control

The family config keeps a מקדם כמות field. It now shows the fitted value with a
"מותאם מהעוגנים" hint and a התאם מהנתונים button; typing a value pins it and the
engine uses the pinned exponent instead of the fitted one.

## Where it shows up

- **Calculator** — the breakdown line states size, quantity, the quantity exponent
  and the resulting factor, e.g. `0.0009 מ״ר · 250 יח׳ · מקדם כמות 0.35 (×1.39)`.
- **Catalog** — the "לפי עקומה" suggestion and the deviation % already pass each
  row's own quantity, so the package rows immediately show distinct, rising
  suggestions instead of repeating the same number.
- The sheets/units-per-sheet numbers stay visible; they keep driving the production
  cost floor (`ceil(sheets) × עלות גיליון × מקדם`), which is unchanged.

## Technical notes

- `src/lib/mdvd.ts`: add `fitQtyCurve(anchors)` returning `{ a, b, e, n }` from a
  log-log least-squares over `(log area, log qty) → log price`; replace the
  sheets-interpolation branch of `priceJob` with this curve, keeping the exact-anchor
  shortcut and the existing cost/threshold/rounding steps. Read the pinned exponent
  from `pricing_config.qty_exponent` when present.
- `src/routes/calculator.tsx`: show the fitted exponent in the family config card
  plus the refit button, and the new breakdown string.
- No schema change — `qty_exponent` already lives in `pricing_config`.
