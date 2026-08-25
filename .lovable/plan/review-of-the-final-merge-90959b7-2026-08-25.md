# Review of the final merge (`90959b7`)

## Verified in this repo

- `bun test src` → **184 pass, 0 fail**.
- The committed migration is byte-identical to a fresh `bun run scripts/generate-config-migration.ts` (only the script's trailing console newline differs) — the generator and the SQL are in sync.
- קאפה seed now carries `wholeBoard: true, boardW: 240, boardH: 120, capW: 120, capL: 240`, and `whole_board / board_w / board_h` are in the live-wins preserve list of every `ON CONFLICT` clause. The earlier gap is closed.
- The 40-vs-46 answer holds: the קאפה config emits `cost_per_m2 = 40` plus `vinyl_cost_sheet: 6`, and `mdvd.ts:1680` computes `sheetCost = cost + vinylCostPerSheet` = 46 per sheet. Seeding 46 would double-count vinyl. Correct as merged.

## One honest caveat (not a blocker)

`wholeBoard / boardW / boardH` are read, written, and shown in the calculator UI, but **no pricing branch reads them** — grep finds no use in `mdvd.ts` outside `readFamilyPricing` / `writeFamilyPricing`. Whole-board billing for קאפה works only because `sheet_yield` already bills `ceil(units / unitsPerSheet)` whole sheets from a 240×120 sheet, which is the same thing. The new test (`100×100 × 1` = `120×120 × 1`) would pass with `wholeBoard: false` as well, so it documents the intent rather than guarding the flag.

Nothing to change before applying — the numbers are right — but the flag is currently descriptive metadata, not an active rule.

## Next steps

1. Apply `supabase/migrations/20260825000000_pricing_config_v3.sql` (idempotent, live-safe).
2. Spot-check in the calculator: מדבקות 5×5×100 → ₪126 · מדבקות ×5 → "מינימום הזמנה 10 יחידות" · מדבקות 22×14×10 quotes via outsourcing · פליירים A5×5000 → ₪600 · שמשונית 120×80×10 → ₪470 · קאפה 100×100×1 = 120×120×1 · no amber "ללא מנוע" badge on any family.
3. Note the open TODO the app itself surfaces: קאפה `yield_table` is empty, so its price is material × margin until the factory tiers are confirmed.
4. Only afterwards: review `reports/dry-run-2026-08-25.csv` and decide on `supabase/cleanup/2026-08-25-app-db-worklist.sql`.
