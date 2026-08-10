# Make the cost model visible in the catalog

The cost data is in place (שמשונית: 20 ₪/מ״ר, threshold 2.4 מ״ר, 80 ₪/מ״ר outsourced, overhead ×2.0) and the app already computes a floor per item. The problem is presentation: the "מתחת לעלות" marker is crammed into the narrow "מחיר לפי עקומה" column and renders as a clipped "מתח…" chip, so nothing looks like it changed. Plus there is no indication of which items cross the outsourcing threshold.

## What changes in the catalog

Two new toggleable columns, on by default:

- **רצפת מחיר** — the cost floor for that exact item (area × rate × qty × overhead factor), shown as a number. When the item's current price is under it, the number turns red and the cell shows a compact red marker; the tooltip spells out direct cost, rate used, and floor.
- **מיקור חוץ** — an anchor-free size flag: items whose area is above the family's threshold get an orange "מיקור חוץ" chip with the tooltip "שטח 2.6 מ״ר · מעל 2.4 מ״ר · הדפסה בחוץ 80 ₪/מ״ר". Items below the threshold show a dash. Families with no threshold defined show a dash.

The truncated badge is removed from the curve column, which goes back to showing just the suggestion and its deviation. Both new columns get proper default widths so nothing clips, and both sort and filter like other numeric/text columns and appear in the Excel/CSV export when visible.

## Filters

- Existing **רק מתחת לעלות** stays, and now visibly matches the new floor column.
- New **רק מיקור חוץ** toggle to sweep the oversized items of a family.

## Row hint

When row coloring is on, items above the outsourcing threshold get a thin orange start-edge bar, so scanning a family shows the size cliff without reading a column.

## Technical notes

- No schema change, no migration. All values derive from `jobCost` / `costFloor` in `src/lib/mdvd.ts` plus the family row and `business_config`, exactly as the calculator does.
- `src/routes/catalog.tsx`: extend `floorByProduct` to also return `{ area, threshold, outsourced, ratePerM2, directCost }`; add `cost_floor` and `outsource` to the `ColKey` union, `COLUMN_LABEL`, default widths, default visibility, sort accessors, column-filter matchers, and the export column map; drop the badge from the `curve_price` cell.
- Colors reuse the existing oklch tokens already used for anomaly/warning cells.
