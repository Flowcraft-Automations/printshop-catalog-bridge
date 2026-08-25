# Review of the last three merges

## What landed

- `0ff1c51` — pricing engine rebuilt around five engines (`anchor_curve`, `per_m2`, `size_ladder`, `sheet_yield`, `unit_floor`), plus `pricing-defaults.ts` as the approved ground truth, `parse.ts`, `EngineBadge`, and 181 tests.
- `dba0ec8` — `supabase/migrations/20260825000000_pricing_config_v3.sql`, `supabase/cleanup/2026-08-25-app-db-worklist.sql`, three CSV reports.
- `830e004` — merge that keeps the Lovable-side fix (sheet families are outsourced above the print limit instead of blocking, separate outsourcing-threshold fields in the calculator).

## Verified

- `bun test src` → 181 pass, 0 fail.
- Build log: build OK.
- The merge did keep both the sheet non-blocking guard in `mdvd.ts` and the separate threshold fields in `calculator.tsx`.

Overall: the code side makes sense and is consistent. The risk is entirely on the data side.

## Problem 1 — every family currently reads as "legacy", so pricing is degraded right now

The DB still holds the old `v3` block with no `engine` key. Families with a config (מדבקות, פליירים, פוליגל, קנבס, קאפה, זכוכית) come back `legacy: true`, which makes `prepareFamily` push "תצורת משפחה ישנה" and `validateSuggestion` reject every suggestion — the אמץ buttons are disabled everywhere until the migration runs. Families such as חשבוניות and פנקסים have no config at all.

So the migration is not optional; the app is in a half-state until it is applied.

## Problem 2 — the migration overwrites live tuning we set together

It replaces the whole `v3` object (`pricing_config || EXCLUDED.pricing_config` merges at the top level only). Concretely for מדבקות:

| Field | Live now | After migration |
|---|---|---|
| `min_order_qty` | 10 | 0 |
| `sheet_margin` | 1.5 | 0 |
| `sheet_units` | `{"5x5": 30}` | `{}` |
| `max_print_w` / `cap_w` | 150 | 0 |
| `cost_per_m2` | 6 | 5 |

That silently undoes the minimum-order rule, the sheet-layout work and the machine-limit fix from the previous sessions. שמשונית is affected less (its qty tier gains the `120x80` size, which is an improvement).

## Recommended course

1. Patch `src/lib/pricing-defaults.ts` so the seeds carry the settings that are already live and approved: מדבקות `minOrderQty: 10`, `sheetMargin: 1.5`, `sheetUnits: {"5x5": 30}`, `maxPrintW: 150`, `capW: 150`, `cost: 6`; keep the other families as written. Regenerate the migration with `bun run scripts/generate-config-migration.ts --write` so the SQL and the defaults stay in sync (a test guards this drift).
2. Re-run `bun test src` and apply the regenerated migration.
3. Spot-check in the calculator after applying: מדבקות 5×5×100, 22×14×1 (must route to outsourcing, not "לא ניתן לייצור"), פליירים A5×5000 = ₪600, שמשונית 120×80×10 = ₪470, and confirm the amber "ללא מנוע" badge is gone.
4. Only then review `reports/dry-run-2026-08-25.csv` and decide on `supabase/cleanup/2026-08-25-app-db-worklist.sql` (it rewrites `final_price` and board statuses for ~130 rows; commented blocks stay commented until you approve them).

## Note

The three amber TODOs are real open questions for the client: kapa yield table, whether the outsourcing rate is VAT-inclusive, and sets-per-book for חשבוניות. Nothing in the code guesses them.
