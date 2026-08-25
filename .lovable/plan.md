# Re-review of the latest merge (`be8d6ad`)

## Verified

- `bun test src` → 183 pass, 0 fail; build OK.
- The migration is no longer a blind overwrite: every `ON CONFLICT` now takes engine/curve data from the seed and re-applies the family's live operational keys on top —
  `min_order_qty, min_order_value, sheet_units, sheet_w, sheet_h, sheet_margin, sheet_gap, max_print_w, max_print_l, cap_w, cap_l, over_limit, mount_cost_m2, mount_cost_unit`.
- מדבקות seed now carries the live tuning (cost 6, minOrderQty 10, sheetMargin 1.5, sheetUnits 5×5→30, maxPrintW/capW 150).
- שמשונית deliberately takes the seed qty tier (`120x80`, ₪47 from 10) — correct.

So the earlier concern is closed. One real gap remains.

## Remaining gap — קאפה loses whole-board billing

Live קאפה config in the database:

```text
whole_board: true, board_w: 240, board_h: 120, cap_w: 120, cap_l: 240,
max_print_w: 60, max_print_l: 90, over_limit: "mount"
```

`whole_board`, `board_w` and `board_h` are **not** in the preserve list, and the קאפה seed (`src/lib/pricing-defaults.ts`) leaves them at `false / 0 / 0`. Applying the migration as-is turns off per-whole-board billing for קאפה — the exact rule set up in the "machine limits and the kapa mounting step" session. Nothing else in the seed compensates: the kapa `yield_table` is still empty (open TODO), so the family would fall back to plain area pricing.

Secondary, smaller: the migration also sets `cost_per_m2 = 40` for קאפה while the live value is 46 (the ₪46/m² raw-material figure you gave). Worth confirming which is intended — 40 is the per-sheet material figure in the seed comment, 46 is the per-m² figure.

## Fix before applying

1. In `src/lib/pricing-defaults.ts`, set the קאפה seed to `wholeBoard: true, boardW: 240, boardH: 120` so the approved board rule is in the ground truth rather than only in the live row, and decide קאפה `cost` (40 vs 46).
2. Add `whole_board`, `board_w`, `board_h` to the preserved-keys array in `scripts/generate-config-migration.ts` so live board settings survive on any family regardless of the seed.
3. Regenerate: `bun run scripts/generate-config-migration.ts --write`, then `bun test src` (the drift guard must stay green).
4. Apply `supabase/migrations/20260825000000_pricing_config_v3.sql`.
5. Spot-check in the calculator: מדבקות 5×5×100 → ₪126, מדבקות ×5 → "מינימום הזמנה 10 יחידות", מדבקות 22×14×10 quotes through outsourcing (not "לא ניתן לייצור"), פליירים A5×5000 → ₪600, שמשונית 120×80×10 → ₪470, קאפה 100×100×1 bills a whole board, and the amber "ללא מנוע" badge is gone on every family.
6. Only afterwards: review `reports/dry-run-2026-08-25.csv` and decide on `supabase/cleanup/2026-08-25-app-db-worklist.sql`.
