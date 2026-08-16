# Above-threshold sticker pricing should scale with size

## The problem

For sheet-method families (מדבקות), any size above the outsourcing threshold is priced with a flat per-unit outsourcing cost: `cost = 80 × quantity`, with no area factor. That's why 110×110 and 200×200 both come out at 105₪ for one piece.

## The new rule

Above the threshold, the outsourcing cost becomes a per-square-meter cost with a one-square-meter minimum charged once per order:

```text
order_area = area(m²) × quantity
cost       = outsource_cost_per_m2 × max(1, order_area)
price      = round_up(cost × margin, rounding)
```

With מדבקות set to 70 ₪/m², margin 1.3, rounding 5:

- 20×20, qty 1 → 0.04 m² → minimum applies → cost 70 → 91 → 95₪
- 100×100, qty 1 → 1.00 m² → cost 70 → 91 → 95₪
- 110×110, qty 1 → 1.21 m² → cost 84.7 → 110.1 → 115₪
- 200×200, qty 1 → 4.00 m² → cost 280 → 364 → 365₪
- 30×30, qty 5 → 0.45 m² total → minimum applies → cost 70 → 91 → 95₪

So everything from the threshold up to 1 m² of total order area costs the same, and above that the price grows linearly with area. Applies to all families using the sheet method. The 80 in the current מדבקות config becomes 70.

## Labels to update

- The family config field "עלות חוץ ₪ ליחידה (מעל הסף)" becomes "עלות חוץ ₪ למ״ר (מעל הסף)" for sheet families.
- The calculation detail line changes from "80₪ ליחידה × 1 × מקדם 1.3" to "70₪ למ״ר × 1.21 מ״ר × מקדם 1.3", and shows "מינימום 1 מ״ר" when the minimum is what's driving the price.

## Technical notes

- `src/lib/mdvd.ts` — in `priceJob`, the sheet + above-threshold branch computes `cost = cfg.outsourceCost × Math.max(1, area × units)` instead of `cfg.outsourceCost × units`, with an updated detail string. `costFloorValue` / `belowCost` follow automatically since they derive from `cost`.
- `src/routes/calculator.tsx` — update the outsourcing-cost field label when the method is sheet.
- Data: set מדבקות `outsource_cost_per_m2` to 70 (currently 80). No schema change — the column already holds a per-m² value for area families; only the sheet-family interpretation changes.
- Existing catalog prices are not rewritten; only calculated/suggested prices change.
