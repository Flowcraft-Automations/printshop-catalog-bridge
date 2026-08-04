# Curve-suggested prices in the catalog

Bring the calculator's fitted pricing curve into the catalog as a per-item suggestion, with colored deviation from the current price.

## What you'll see

Two new columns in the catalog table (both toggleable in the column chooser, off by default except the suggestion):

- **מחיר לפי עקומה** — the price the family's fitted curve gives for that item's exact size, rounded to 5 ₪.
- **סטייה מהעקומה** — the % difference between the item's current price and the suggestion.

Coloring on the suggestion cell:
- neutral when within 5% of the current price
- amber when 5–20% off
- red when more than 20% off
- grey "—" when the family has too little data to fit a curve (fewer than 2 usable anchors) or the item has no size

Rules used:
- Current price for comparison = מחיר סופי if set, otherwise מחיר סנזיי, otherwise מחיר אתר.
- The curve is fitted per family from that family's own qty=1 items, exactly as the calculator does (same outlier filter), so the numbers match what the calculator shows.
- An item that is itself an anchor in its family's fit still gets a suggestion (its own deviation from the line is what reveals it as an outlier).

Actions:
- A small "אמץ" button appears in the suggestion cell when the value differs from the current price; it writes the suggestion into **מחיר סופי** for that row (same interaction pattern as the existing מחיר מוצע column).
- A filter toggle **רק חריגים מהעקומה** shows only items deviating more than 20% from their family curve, so you can sweep a family for items to reprice.
- Both new columns are included in the Excel/CSV export when visible.

## Technical notes

- `src/routes/catalog.tsx` already loads every product, so the per-family fit can be computed client-side. Add a `useMemo` that groups products by family and runs the existing `buildAnchors` + `fitFamilyLine` from `src/lib/mdvd.ts` once per family, producing `Map<family, FamilyFit | null>`.
- Per row: `suggested = round5(fit.base + fit.rate * area)` where `area = width_cm * height_cm / 10000`; `deviation = (suggested - current) / current * 100`.
- Add `curve_price` and `curve_dev` to the `ColKey` union, `COLUMN_LABEL`, default widths, visibility defaults, the sort accessor map, and the numeric column-filter path so they sort and filter like other numeric columns.
- Colors come from the existing status/anomaly oklch token style already used in the table, not new hardcoded hex.
- No schema change and no pricing-logic change: the suggestion is derived, never stored, until you press אמץ.
