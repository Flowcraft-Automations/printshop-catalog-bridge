# Add quantity packages for 3 more sticker sizes

Same treatment as the earlier round sticker sizes: turn each single row into a full set of quantity packages, using the website prices from the screenshots.

## Sizes covered

- קוטר 10-15 ס"מ
- קוטר 16-6 ס"מ (screenshot shows "6-16")
- קוטר 24-6 ס"מ (screenshot shows "6-24")

All three share the same price ladder:

| Units | Website price |
|---|---|
| 100 | 187 |
| 150 | 198 |
| 200 | 217 |
| 250 | 242 |
| 500 | 340 |

## What happens per size

- The existing row becomes the **100 units** variant: quantity set to 100, name gets "100 יחידות", website price 187.
- Four new rows are created for 150 / 200 / 250 / 500 with the matching website prices.
- New rows keep the same family, size, and website link; Senzey price stays empty and Senzey status is set to **להוספה** so they show up as items to create in the ERP.
- Website status set to "ללא שינוי" for the new rows (they already exist on the site).

## 17-17 (80 יחי)

That page has no quantity dropdown — it is a single fixed 80-unit product at ₪270, and the catalog row already matches (qty 80, price 270). No change needed.

## Technical note

Executed as data changes only (updates to the three existing rows plus 12 new rows). Each new row gets a unique row_key suffix so a future import will not duplicate them. No schema or code changes.
