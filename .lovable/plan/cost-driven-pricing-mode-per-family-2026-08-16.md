# Cost-driven pricing mode per family

Today the first block (עלות ייצור למשפחה) only produces a floor: cost × תקורה. It never produces a customer price, so the calculator falls back either to a matching catalog item or to the fitted anchor curve. That is why the second row exists.

This change makes the cost block able to drive the price on its own, so families that are simple can be configured with one table only.

## What changes on screen

In the cost row, next to מקדם תקורה, add:

- **מצב תמחור** — a small two-option switch per family: `לפי עלות` / `לפי מחיר ללקוח`.
- When `לפי עלות` is selected: two extra fields appear in the same flat style — **רווח % (מעל התקורה)** and **מחיר מינימום ₪**. The whole מחיר ללקוח למשפחה block is hidden.
- When `לפי מחיר ללקוח` is selected: behaves exactly as today.

Row 3 (עיגול מחיר · הנחות כמות · שמור) and the בדיקה מהירה box stay shared and work in both modes.

## Pricing rule in cost mode

```text
direct = ₪/מ״ר (or ₪/מ״ר מיקור חוץ above threshold) × area × qty
price  = direct × מקדם תקורה × (1 + רווח%/100)
price  = max(price, מחיר מינימום, מינימום למטר אורך × meters)
price  = rounding + quantity discount, as today
```

Threshold side is decided by the same "fits in the box" rule already used (longer side ≤ סף רוחב and shorter side ≤ סף גובה).

The בדיקה מהירה box shows the same breakdown it shows now: which side of the threshold, the direct cost, the multipliers and the final price. In cost mode the below-floor warning can never fire, since the price is derived from the floor.

## Precedence

Unchanged in order, with cost mode slotted in where the configured price was:

1. exact catalog match (decided price)
2. family pricing — cost mode or customer-price mode, whichever the family is set to
3. anchor power curve, when the family has neither configured

## Technical notes

- Storage stays `families.pricing_config` (JSON), no schema change. Add `mode: "cost" | "customer"`, `margin_pct`, and `min_charge` under the existing `customer` object, read with defaults in `readCustomerPricing` (`mode` defaults to `customer` for existing families, and to `cost` only when nothing is configured).
- `src/lib/mdvd.ts`: new `priceFromCost(family, cfg, w, h, qty)` reusing `fitsInBox`, `jobCost` and `applyRounding`; it returns the same shape `priceFromConfig` returns (`total`, `unit`, `side`, `minApplied`, `linearApplied`, `detail`) so the calculator needs no branching beyond picking the function. `hasCustomerPricing` gains a cost-mode arm so a cost-configured family is not treated as unconfigured.
- `src/routes/calculator.tsx`: add the mode switch plus the two fields to the cost row, conditionally hide the customer block, and route the price through the selected function. The existing שמור buttons persist the new keys.
- No migration required; שמשונית and מדבקות keep their current customer-mode config and verification numbers.
