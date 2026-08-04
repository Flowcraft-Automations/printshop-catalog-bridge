# Change history per catalog item

Every edit to a product gets recorded, so you can see what changed, when, and roll a field (or a whole edit) back.

## What you get

- A new `product_history` table that stores, for each change: the product, the field name, the old value, the new value, and the timestamp.
- History is written automatically by the database on every update to a product — inline table edits, drawer saves, bulk status changes, and imports are all covered without extra app code.
- In the product drawer, a new "היסטוריית שינויים" section lists changes newest-first: field label, old → new, and time.
- Each history row has a "שחזר" (revert) button that writes the old value back to that field. The revert itself is also logged, so nothing is lost.
- Grouped edits (one save touching several fields) can be reverted together with a single "שחזר את כל השינוי" action on the group.
- Only real changes are logged; unchanged fields are skipped. Imports are labeled with source `import` so you can tell bulk changes from manual ones.

## Technical notes

- Migration adds `public.product_history`:
  `id`, `product_id` (FK → products, cascade delete), `field`, `old_value` (text), `new_value` (text), `changed_at`, `batch_id` (uuid, groups fields changed in one statement), `source` (text).
  GRANTs to `anon`/`authenticated`/`service_role` matching the existing permissive policy style used by `products` (app is behind the password gate).
- A `BEFORE/AFTER UPDATE` trigger function on `products` compares old vs new for the tracked columns (`name`, `family`, `width_cm`, `height_cm`, `qty`, `senzey_exists`, `senzey_ids`, `senzey_price`, `senzey_dup_count`, `site_exists`, `site_url`, `site_price`, `final_price`, `senzey_status`, `site_status`, `anomaly`, `notes`, `verified`) and inserts one row per differing column, sharing a `batch_id`. `updated_at`/`verified_at` are not logged as changes.
- Index on `(product_id, changed_at desc)`.
- New `productHistoryQuery(productId)` in `src/lib/queries.ts`; drawer loads it lazily when opened.
- Revert = a normal `update` on `products` setting the field back to the stored old value (cast per column type), then invalidate `products` + history queries.
- No retention limit added; if the table grows too large later we can add a cleanup job.
