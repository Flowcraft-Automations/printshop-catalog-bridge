# Anchor-based pricing — rebuild config screen and engine

Everything in the current pricing configuration is replaced. Per family there is one method selector, a threshold, 3–4 numbers, and an anchor table. Nothing else.

## Family config screen

Matches the mockup exactly (navy card, flush fields, anchor table, "+ הוסף עוגן", "שמור").

**Type A — לפי מ"ר** (שמשונית)
- שיטת תמחור · סף רוחב · סף גובה
- עלות ייצור ₪/מ"ר (מתחת לסף) · עלות מיקור חוץ ₪/מ"ר (מעל הסף) · מקדם רווח (1.3) · עיגול ₪ (5)
- Anchors table: מידה | מחיר ⚓ | ✕

**Type B — לפי גיליון** (מדבקות)
- שיטת תמחור · סף רוחב · סף גובה
- עלות ייצור ₪ לגיליון · עלות חוץ ₪ ליחידה · מקדם רווח · חבילות (comma list)
- Anchors table: מידה | יחידות בגיליון | חבילה | מחיר ⚓ | ✕
- יחידות בגיליון pre-fills from a 45×32 cm sheet with 0.5 cm gaps, marked אוטומטי; once edited it is marked ידני and applies to every row of that size.

Removed: minimum-price fields, minimum per linear meter, base + rate trios, sheet setup/price-per-sheet, qty exponent, qty discounts, curve fitting, curve chart, and all advanced/visualization blocks in the calculator.

## Anchors are catalog items

The anchor table and the catalog's anchor flag are two views of one dataset.
- Adding a row creates or updates a catalog product: auto name (`מדבקות 5/5 — 100 יח׳`), family, width/height, qty, `final_price` = anchor price, `is_anchor` = true.
- Editing the price in either place updates the same product.
- Deleting a row clears the anchor flag only; the product stays.
- Anchors without a price are ignored by the engine.
- Inconsistent anchors (priced below a smaller one) are excluded and flagged on the config screen: "עוגן לא עקבי: {מידה}".

## Engine — priceJob(family, w, h, qty)

Above = the job does not fit the threshold box (longer side ≤ סף רוחב AND shorter side ≤ סף גובה).

Type A below: anchors sorted by area → exact match within ±2% area returns the anchor price; between two anchors, linear interpolation on area; below the smallest, the smallest anchor's price (the only floor); above the largest but under threshold, extend the largest anchor's ₪/מ"ר. Multiply by qty.
Type A above: עלות חוץ × מ"ר × מקדם × qty.

Type B below: each anchor → sheets = חבילה ÷ יחידות בגיליון, giving one price-vs-sheets curve; the request converts to sheets and interpolates; fewer sheets than the smallest anchor → smallest anchor's price; more than the largest → extend the last segment's slope.
Type B above: עלות חוץ ליחידה × qty × מקדם.

All results rounded up to the עיגול step. Empty dimensions show "הזינו מידות" and no price.

## Calculator UI

- Type B families: the free quantity field becomes a package dropdown built from חבילות, each option showing its computed price.
- Below-cost warning wherever a price appears (calculator and catalog): price < production cost × מקדם, where production cost is area × עלות ייצור (A below), sheets × עלות גיליון (B below), or the outsource cost (above threshold).

## Seeds

- שמשונית: לפי מ"ר, threshold 160×150, cost 20, outsource 80, factor 1.3, rounding 5. Anchors = the catalog items that already carry the anchor flag; none invented.
- מדבקות: לפי גיליון, threshold 20×20, sheet cost 5, outsource 80/unit, factor 1.3, packages 100,150,200,250,500. Anchors: 5×5 with יחידות בגיליון 30 (ידני), package 100 = 126 and package 500 = 230.

## Verification

שמשונית 100×80 anchored at 85 → 85 · a size between two anchors → strictly between, proportional to area · 200×180 → 3.6 × 80 × 1.3 → 375 · מדבקות 5×5 pkg 100 → 126, pkg 250 → ~155–160, pkg 500 → 230 · מדבקות 30×30 → 105 · adding 6×6 / 200 / 190 creates the anchored product and shifts neighbours · anything below the smallest anchor → smallest anchor's price · empty dimensions → "הזינו מידות".

## Technical notes

- `families` columns reused: `outsource_width_cm`/`outsource_height_cm` = threshold, `cost_per_m2` = cost per m² or per sheet, `outsource_cost_per_m2` = outsource cost. `pricing_config` shrinks to `{ method, margin, rounding, packages, sheet_units: { "5x5": 30 } }`; all other keys are dropped on save.
- `src/lib/mdvd.ts`: new `priceJob` plus anchor builders/interpolators; delete `priceFromConfig`, `priceFromCost`, `priceFromCurve`, `priceFromLine`, `fitPowerCurve`, `fitFamilyLine`, `fitQtyExponent`, `qtyFactor`, `computePrice`, and their types.
- `src/routes/calculator.tsx` rewritten around the mockup; `src/components/CurveChart.tsx` removed and its catalog usage with it. Catalog keeps the anchor column, now writing through the same mutation as the config table.
- Legacy columns (`rate_m2`, `base_price`, `qty_exponent`, `qty_discounts`, `min_charge`, `outsource_area_m2`) stop being read or written; a migration drops them once the UI no longer references them.
