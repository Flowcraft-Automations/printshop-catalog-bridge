# v2 data import — everything is already built

I checked the app and the database. All six sections of your request were already implemented in the previous round:

- The five new fields exist on the products table (`senzey_group`, `site_category`, `competitor_price`, `competitor_ref`, `proposed_price`).
- The import page reads all 24 product columns, parses TRUE/FALSE/true/false/כן/לא, keeps the preview step, and never overwrites `final_price`, statuses or notes on existing rows.
- Catalog has the two new columns, competitor/proposed prices with the info tooltip, the אמץ button, the new filters (approved new, has proposed price, duplicates, group + category dropdowns) and the new editable drawer fields.
- מיפוי קטגוריות exists in the nav between מחשבון מידות and מוצר חדש, and links through to a filtered catalog.
- Migration board shows the חדש מאושר badge; dashboard has the מוצרים חדשים מאושרים KPI.

The only thing missing is the data itself. The database currently holds 1,049 products with 0 approved-new rows and all five new fields empty.

## What I'll do

1. Load `MDVD_app_seed_data_v2_2.xlsx` through the same rules the import page uses: update the 1,049 existing rows with the new fields while protecting `final_price`, `senzey_status`, `site_status` and `notes`, and insert the 10 `approved_new` rows as-is.
2. Report back the verification numbers: total products, approved-new count, rows with group / category / proposed price / competitor price, and a spot-check that manually edited rows kept their price, statuses and notes.

Expected after import: 1,059 products, 10 approved new, 818 with a Senzey group, 389 with a site category, 36 proposed prices, 21 competitor prices.

If you'd rather run it yourself, skip this and just upload the file on the ייבוא נתונים page — the result is identical.
