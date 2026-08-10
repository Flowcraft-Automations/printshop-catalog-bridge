# Cost floor per family (שמשונית: 20 ₪/מ״ר, 80 ₪/מ״ר above 1.5×1.6 m)

The curve says what to charge. It has no idea what the job costs. Genadi's numbers give us the missing half, so the app can tell you when a suggested price is below cost — and where the outsourcing cliff sits.

## The cost model

Per family, three numbers:

1. **עלות חומר + הדפסה למ״ר** — for שמשונית: 20 ₪/מ״ר (5 material + ~7–15 print).
2. **סף מיקור חוץ** — the area above which printing goes outside. For שמשונית: 1.5 m × 1.6 m = 2.4 m².
3. **עלות מיקור חוץ למ״ר** — 80 ₪/מ״ר for שמשונית.

Cost of a job = area × (rate below the threshold, outsource rate above it) × quantity. Above the threshold the whole job uses the outsource rate — that is what actually happens, and it is why large sizes need their own anchor.

On top of that sits the business overhead you mentioned: ₪200k spent monthly against ₪175k invoiced. Expressed as a factor on direct cost, that is the "מקדם תקורה" field — a single editable multiplier (default 2.0, meaning a job must sell for at least twice its material+print cost to carry labor and overhead).

## What you see in the calculator

Under the calculated price, a compact cost strip:

```text
שטח 0.16 מ״ר · עלות ישירה ₪3  ·  רצפת מחיר (×2.0) ₪6
מחיר לפי עקומה ₪70  ·  רווח גולמי ₪67 (96%)
```

And for a size past the threshold:

```text
מעל 1.5×1.6 מ׳ — הדפסה במיקור חוץ, עלות ₪80 למ״ר
שטח 2.6 מ״ר · עלות ישירה ₪208 · רצפת מחיר ₪416
מחיר לפי עקומה ₪180  ← מתחת לעלות
```

When the curve price is below the cost floor the strip turns red and offers the floor price as a one-click replacement. The curve itself is never silently changed.

The threshold also shows on the curve chart as a vertical marker labelled "מיקור חוץ", so it is visually obvious that anchors on both sides of it are needed.

## In the catalog

- **מחיר לפי עקומה** rows whose suggestion is below the family's cost floor get a red cost marker with the cost in the tooltip.
- New filter **רק מתחת לעלות** to sweep a family for underpriced items.
- Marker only — adopted prices still come from your click.

## Where the numbers are edited

The family panel in the calculator gains three fields next to the existing minimum charge and quantity exponent: cost per m², outsource threshold (m²), outsource cost per m². Values are per family and saved to the database; שמשונית is seeded with 20 / 2.4 / 80. The overhead factor is one global value shared by all families.

## Technical notes

- Migration: add to `families` — `cost_per_m2 numeric default 0`, `outsource_area_m2 numeric` (nullable), `outsource_cost_per_m2 numeric`; plus a single-row `business_config` table (`monthly_cost`, `monthly_revenue`, `overhead_factor`) with GRANTs and permissive RLS matching the existing `families` pattern, seeded 200000 / 175000 / 2.0. A data update sets the שמשונית row to 20 / 2.4 / 80.
- `src/lib/mdvd.ts`: `jobCost(family, area, qty)` → `{ directCost, ratePerM2, outsourced }` and `costFloor(directCost, overheadFactor)`. Pure, no side effects; the power-curve pricing path is untouched.
- `src/routes/calculator.tsx`: cost strip under the result, the three family fields, overhead factor field, chart threshold marker.
- `src/routes/catalog.tsx`: reuse `jobCost` against each row's existing curve suggestion for the marker and the new filter.
