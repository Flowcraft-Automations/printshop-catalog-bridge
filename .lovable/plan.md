# Above-threshold sticker pricing should scale with size

## The problem

For sheet-method families (מדבקות), any size above the outsourcing threshold is priced with a flat per-unit outsourcing cost. The engine computes `cost = 80 × quantity` with no area factor, so 110×110 and 200×200 both come out at 105₪ for one unit. Below the threshold the price does react to size (through sheets per size and anchors), but above it does not.

## The fix

Treat the above-threshold outsourcing cost as ₪ per square meter for sheet families, matching how the area method already works:

```text
cost  = outsource_cost_per_m2 × area(m²) × quantity
price = round_up(cost × margin, rounding)
```

With the current מדבקות settings (80 ₪/m², margin 1.3, rounding 5):

- 110×110, qty 1 → 1.21 m² → cost 96.8 → 125.84 → 130₪
- 20×20, qty 1 → 0.04 m² → cost 3.2 → 4.16 → 5₪
- 200×200, qty 1 → 4 m² → cost 320 → 416 → 420₪

Applies to all families using the sheet method.

## Labels to update

- The calculator's family config field "עלות חוץ ₪ ליחידה (מעל הסף)" becomes "עלות חוץ ₪ למ״ר (מעל הסף)" for sheet families, so the number's meaning is clear.
- The result detail line changes from "80₪ ליחידה × 1 × מקדם 1.3" to "80₪ למ״ר × 1.21 מ״ר × 1 × מקדם 1.3".

## Technical notes

- `src/lib/mdvd.ts` — in `priceJob`, the `cfg.method === "sheet"` + `above` branch multiplies the outsourcing cost by `area` as well as `units`, and its detail string is updated. The `costFloorValue` / `belowCost` line follows automatically since it derives from `cost`.
- `src/routes/calculator.tsx` — update the outsourcing cost field label for sheet families.
- No database or schema change: `outsource_cost_per_m2` already stores this value; only its interpretation for sheet families changes.
- Existing above-threshold sticker prices in the catalog are not rewritten; only suggested/calculated prices change.
