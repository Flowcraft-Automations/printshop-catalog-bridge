# Use website prices in the calculator (fix "missing" items like שמשונית)

## What I checked

I compared the new file `MDVD_app_seed_data_v2_3.xlsx` against the database row by row:

- File: 1,059 products — database: 1,059 products. Nothing missing, nothing extra.
- Website prices: 398 in the file, 398 in the database.
- שמשונית: 287 items in both; 134 of them have a website price in both.
- Only 4 rows differ, and those are your own manual edits.

So the import is complete. The items that "disappear" are being dropped later, by the calculator.

## The real cause

The calculator builds its pricing anchors from `final_price`, and falls back to `senzey_price` only. Any product that is priced **only on the website** is skipped — it never becomes an anchor and never influences the fitted price line.

For שמשונית this is severe: 287 items in the family, but 153 of them are website-only or partly website-priced, so a large part of the real price ladder is invisible to the calculator.

## What to change

1. Anchor price source becomes: `final_price` → `senzey_price` → `site_price` (first available wins). Track which source was used.
2. When both Senzey and site prices exist and differ, prefer Senzey (ERP is the source of truth) but keep the item as an anchor.
3. The family items panel marks each row with its price source (סופי / סנזיי / אתר) so it is obvious where a number came from.
4. The plain-language breakdown mentions when the fit relies on website prices, e.g. "מבוסס גם על מחירי אתר".
5. Similar-products panel shows the same effective price rather than a blank when only the website price exists.

## Technical notes

- `buildAnchors` in `src/lib/mdvd.ts`: extend the price pick to include `site_price`, add a `source: "final" | "senzey" | "site"` field on `Anchor`, and keep the existing dedupe-by-area preference order (final > senzey > site, then lowest price).
- The ×2.5 median price-per-m² anomaly filter stays unchanged and now runs over the larger anchor set.
- `src/routes/calculator.tsx`: show the source tag per family item, and extend the anchor/breakdown text. No schema or import changes needed.
