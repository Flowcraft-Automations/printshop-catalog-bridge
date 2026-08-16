# Generic size thresholds for every family

## Plain English — what this is

Right now each family has exactly one threshold, and it only does one thing: "above 150×160 cm we send the print out, so cost per m² jumps to 80". Everything else — the minimum charge, the cost per m², the quantity discount curve — is a single set of numbers for the whole family, no matter the size.

But מדבקות proved that's not how the shop works. A sticker under 20 cm and a sticker over 20 cm are two different products, made on two different machines, with two different costs. Gena's words: from 20 cm and up a sticker is produced like a שמשונית and priced like one, minimum ₪70; below 20 cm it's ganged onto an A3-ish sheet costing ₪4 (₪3 material + ₪1 cut) and cut out.

Instead of hardcoding that for stickers, the family gets **size tiers**: a list of size bands, each with its own cost, its own minimum price, and its own anchors. The existing outsourcing threshold becomes just one tier among others. Then שמשונית, מדבקות, and anything Gena invents next all use the same mechanism.

## How a tier works

A family holds an ordered list of tiers. Each tier says **when it applies** and **how it prices**:

```text
tier = {
  label:      "מדבקות גיליון"        what to show in the calculator
  applies:    up to 20 cm on both sides   (or: from X cm, or: from area Y m²)
  cost mode:  per m²  →  cost_per_m2
              per sheet → sheet_cost + units_per_sheet   (new)
  min_charge: minimum price for anything in this band
  qty_exponent: bundle discount curve for this band
}
```

The calculator picks the first tier whose size rule matches the entered width × height, then everything downstream — cost floor, minimum charge, bundle discount, which anchors feed the curve — reads from that tier instead of from the family row. Anchors already live on products; they get grouped by which tier their size falls into, so each band fits its own curve and a small sticker never drags a large one down.

Outsourcing stops being special: it is simply the top tier of שמשונית, "from 150×160 cm, cost 80 ₪/m²".

## Configuration for the two families we know

**שמשונית** — same numbers as today, expressed as tiers:

```text
1. up to 150×160 cm   per m² ₪20   min ₪25   qty exp 0.85
2. from 150×160 cm    per m² ₪80   min ₪25   qty exp 0.85
```

**מדבקות** — the split the meeting settled:

```text
1. under 20 cm   per sheet: ₪4 per sheet, units per sheet from Gena's table   min ₪20
2. from 20 cm    per m² ₪20 (same press as שמשונית)                            min ₪70
```

Tier 2 immediately flags every large sticker we sell under ₪70 — 100×100 at ₪60, 120×80 at ₪60, 70×20 at ₪29, 56×17 at ₪50 — as below floor.

Tier 1 is configured but incomplete: the units-per-sheet count per size (3×3, 4×4, 5×5 … 15×15) is the table you're building with Gena. Only ⌀5 → ~30 per sheet is known. Until it lands, tier 1 prices stay as they are and only the ₪20 minimum applies.

## Where this shows up in the app

- **Calculator** — a line under the size inputs saying which tier the entered size landed in and why ("מגודל 20 ס״מ — מיוצר כשמשונית"), with the cost floor and minimum from that tier. Admin tier settings replace the current single outsourcing block.
- **Catalog** — the cost floor column uses the item's tier, so the below-floor warning is finally correct for large stickers.
- **Curve chart** — a marker at each tier boundary, and one fitted curve per tier instead of one across the whole family.

## Technical notes

- Schema: add a `tiers` jsonb column to `families`, and migrate the existing `outsource_*` and `cost_per_m2` / `min_charge` values into a two-tier default per family so nothing changes behaviour on day one. The old columns stay readable until the UI is fully switched over.
- `src/lib/mdvd.ts`: `jobCost()` gains a tier lookup (`pickTier(family, w, h)`) and a per-sheet cost mode; `buildAnchors()` / `fitPowerCurve()` get grouped per tier.
- `src/routes/calculator.tsx`, `src/routes/catalog.tsx`, `src/components/CurveChart.tsx` read tier values instead of the flat family fields.
- Sticker family data (assigning items to the right side of the 20 cm break, fixing the 10 items with מחיר אתר = 0, and fixing the 9×9 bundle rows that all store `qty = 100`) is a separate data pass after the tiers exist.

## Also: the dashboard

The dashboard exists at `/` but the header nav only lists קטלוג, מחשבון מידות and משתמשים, so there's no way to reach it. Adding a "לוח בקרה" link as the first nav item in `src/components/AppShell.tsx` fixes it.
