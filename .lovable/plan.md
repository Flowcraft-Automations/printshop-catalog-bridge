# Statuses follow price edits automatically

## The rule

Each system's status reflects what happened to that system's own price:

- Edit **מחיר סנזיי** -> `סטטוס סנזיי` becomes **עלה** (new > old), **ירד** (new < old), or **ללא שינוי** (same value).
- Edit **מחיר אתר** -> `סטטוס אתר` becomes **עלה** / **ירד** / **ללא שינוי** the same way.
- Statuses set to **נמחק**, **כפילות נמחקה** or **לא רלוונטי** are left alone — those are lifecycle decisions, not price outcomes.
- Auto always wins: a status you pick by hand is not locked, the next price edit re-derives it.
- `מחיר סופי` no longer drives statuses. When it is edited it just mirrors the decided price; the two system statuses stay tied to their own price columns.

This applies everywhere a price is edited: inline in the table, in the item drawer, bulk edits, and the "אמץ" (adopt suggested price) action.

## One-time retroactive pass

Recalculate statuses for items whose statuses you never edited by hand (424 of 1,062 items have manual status edits — those are skipped).

For each untouched item:

- If the change log has a previous value for that price column, set the status from the direction of that change.
- If the price was never changed since import, set **ללא שינוי** (or leave **לבחינה** where the item was never priced at all — nothing to compare).
- Never overwrite נמחק / כפילות נמחקה / לא רלוונטי.

The pass runs as a one-off database update, and the resulting changes are recorded in each item's change history so they can be reverted.

## Technical notes

- Replace `autoStatusFromPrice` in `src/lib/mdvd.ts`: it takes the previous product row and the patch, and derives `senzey_status` from `senzey_price` old vs new, `site_status` from `site_price` old vs new. Closed statuses are skipped.
- In `src/routes/catalog.tsx`, the `update` mutation applies the derived statuses on every price-containing patch, and no longer suppresses them when the caller also passes a status — the derived value overrides.
- Drawer save keeps sending an explicit status only when the user changed the dropdown and no price changed in the same save.
- Retroactive fix: a single SQL update joining `products` to the latest `product_history` row per (`product_id`, `senzey_price` / `site_price`), excluding items that have any `senzey_status` / `site_status` history entry.
