# Package rows for round stickers (מדבקות)

Each round-sticker product on the website sells in 5 quantity packages (100/150/200/250/500) at different prices, all under one product link. The catalog currently holds a single row per size. This creates one row per size+package so every future Senzey item already exists in the app.

## What happens

For each of the 10 sizes below:

- The existing row becomes the **100 units** variant: `qty = 100`, website price set from the site, name suffixed with `100 יחידות`.
- Four new rows are created for 150 / 200 / 250 / 500, copying family, size, website link and site category from the original.
- New rows: website price from the site, website status `ללא שינוי`, Senzey price empty, `קיים בסנזיי` off, Senzey status **להוספה**, not verified, not anchor.
- Existing rows keep their current Senzey data untouched (prices/statuses stay as they are).

## Prices to load (₪, website)

| Size (cm) | 100 | 150 | 200 | 250 | 500 |
|---|---|---|---|---|---|
| 3×3 | 115 | 122 | 134 | 150 | 210 |
| 4×4 | 121 | 128 | 140 | 156 | 220 |
| 5×5 | 126 | 134 | 147 | 163 | 230 |
| 5×8 | 126 | 134 | 147 | 163 | 230 |
| 6×6 | 137 | 146 | 160 | 178 | 340 |
| 7×7 | 148 | 157 | 172 | 192 | 270 |
| 8×8 | 148 | 157 | 172 | 192 | 270 |
| 5×9 | 154 | 163 | 179 | 199 | 280 |
| 9×9 | 154 | 163 | 179 | 199 | 280 |
| 10×10 | 187 | 198 | 217 | 242 | 340 |

Result: 50 rows total (10 updated + 40 new).

## Technical notes

- Data-only change through the data tool; no schema or code changes.
- The 9×9 row is already `qty = 100` with site price 154 — it only gets the name suffix check, no price change.
- New rows get a unique `row_key` derived from the existing row key plus the quantity, so a future re-import won't duplicate them.
- Sizes 5×8, 5×9, 10×10 currently carry site price 0 or a copy-link; the site price is corrected from the table above while the link is kept as-is.
