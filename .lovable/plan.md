# Apply the pricing config migration (families only)

## What runs

`supabase/migrations/20260825000000_pricing_config_v3.sql`, exactly as it sits in the repo — 200 lines, idempotent, safe to re-run.

Verified by reading the file:
- 5 × `ALTER TABLE public.families ADD COLUMN IF NOT EXISTS ...` (no-ops, the columns already exist)
- 10 × `INSERT INTO public.families ... ON CONFLICT (family) DO UPDATE` — configuration upserts
- 1 further family block (מדבקה בטחונית) is fully commented out and will not run
- The only occurrence of the word `products` in the file is inside a comment. There is no statement that inserts, updates or deletes a catalog row.

Existing rows keep their live operational tuning (minimum order, sheet layout, machine limits, mounts, whole-board flags); engine and curve data comes from the seed.

## Catalog rule

`public.products` is untouched. No inserts, no updates, no deletes, no verified/anchor flag changes, no duplicate cleanup. If a check below comes out wrong, the number gets reported as-is — no data is edited to make it match.

## After it runs — checks in the calculator, family מדבקות

| size × qty | expected |
|---|---|
| 115×8 × 10 | ₪755 |
| 100×80 × 1 | ₪115 |
| 16×6 × 100 | ₪187 |
| 17×17 × 80 | ₪270 |
| 5×5 × 100 | ₪126 |

Also: the red "תצורה שגויה: דלי הסל 10+" banner should be gone.

These will be run against the engine directly (the test harness reads the same config the app reads), and any mismatch reported with the value obtained plus the "rows marked אומת" count — no data changes.

## Note

The three `anchor-שמשונית-*` catalog rows came from an older version of the generator. That code is gone; nothing here will add, change, or remove them.
