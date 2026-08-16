# One universal, config-driven pricing engine

## What we're building, in plain English

Today pricing rules are baked into the code: one cost per m², one minimum, one outsourcing threshold, one curve. Every new way of pricing (running metre, sheets, "same as another family") needs new code.

After this refactor, each family carries a **pricing configuration** — a list of size bands, each with a pricing method and its numbers. The code knows only the methods; the shop's rules live entirely in configuration. שמשונית, מדבקות, and anything Gena invents later are just different configs. The same config will later drive the public website calculator, so nothing in it may assume an admin is looking.

## 1. Configuration shape

A `pricing_config` jsonb column on `families`:

```json
{
  "tiers": [
    { "name": "סרט", "match": {"max_h": 50},
      "method": "per_running_meter", "params": {"rate": 55, "min": 35},
      "cost": {"cost_per_m2": 20} },
    { "name": "יריעה אחת", "match": {"max_h": 160},
      "method": "area_linear", "params": {"base": 20, "rate_m2": 52, "min": 40},
      "cost": {"cost_per_m2": 20} },
    { "name": "שתי יריעות", "match": {},
      "method": "area_linear", "params": {"base": 0, "rate_m2": 100, "min": 0},
      "cost": {"cost_per_m2": 40} }
  ],
  "qty_model": { "type": "tiers", "tiers": [{"min_qty": 10, "mult": 0.85}, {"min_qty": 20, "mult": 0.75}] },
  "rounding": { "step": 5, "direction": "up" },
  "cost": { "overhead_mult": 1.3 }
}
```

Matching: `w` is the longer side, `h` the shorter. The first tier whose conditions (`min_w` / `max_w` / `min_h` / `max_h`, all optional) all pass wins. An empty `match` is the catch-all and must be last.

Methods:

- `area_linear` — `base + rate_m2 × area_m2`, never below `min`.
- `per_running_meter` — `rate × longer side in metres`, never below `min`.
- `per_sheet` — params `sheet_w`, `sheet_h`, `gap_cm`, `setup_fee`, `sheet_rate`, `sheet_cost`, optional `units_overrides` (`{"5x5": 30}`). Units per sheet = override, else `floor((sheet_w+gap)/(w+gap)) × floor((sheet_h+gap)/(h+gap))`. `sheets = ceil(qty / units)`, `price = setup_fee + sheets × sheet_rate`. Quantity is already inside the price, so the qty model is skipped. Floor = `sheets × sheet_cost`.
- `reference` — `{"family": "שמשונית", "overrides": {"min": 70}}`: run the referenced family's tiers, then apply overrides.

Each tier carries its own cost params (`cost_per_m2`, `sheet_cost`, or `outsource_per_m2`). Floor = computed cost × `overhead_mult`, and this single floor drives the below-floor warnings everywhere.

## 2. The engine

One function, `priceJob(family, w, h, qty)`, in `src/lib/pricing.ts`:

1. Resolve the tier (following `reference` chains, guarding against loops).
2. Compute by method.
3. Apply the qty model — skipped for `per_sheet`.
4. Round per config.
5. If the requested size and quantity match an existing catalog anchor within ±2% area, return that anchor's price labelled "מחיר קטלוג" instead of the formula.
6. Always attach the cost floor and the resulting margin.

It returns the price plus a **breakdown generated from the config** — tier name and the formula with the real numbers substituted. No hardcoded sentences.

## 3. Quantity models

`tiers` (an explicit list of `min_qty` → multiplier, the new default) or `power` (today's exponent `c`). Selectable per family; every family is seeded with explicit tiers converted from its current behaviour.

## 4. Migration — identical behaviour on day one

Convert each family's flat fields (`cost_per_m2`, `min_charge`, size thresholds, outsourcing fields, the ×1.3 overhead, `c = 0.85`) into `pricing_config`. The old columns stay readable until every screen is switched over.

Seed שמשונית with the three tiers exactly as above. Seed מדבקות with:

- **קטנות** — `match {"max_w": 19.9, "max_h": 19.9}`, `per_sheet`, params `sheet_w 45, sheet_h 32, gap_cm 0.5, setup_fee 94, sheet_rate 8, sheet_cost 4`, `units_overrides {"5x5": 30}`.
- **גדולות** — `match {}`, `reference` → שמשונית with overrides `{"min": 70}`.

## 5. Settings UI per family

A tier editor: table of tiers with add / remove / reorder, a method dropdown, and a params form that changes with the chosen method. Plus editors for the qty model, rounding and overhead. A live test box (width, height, quantity) shows the matched tier and the resulting price, updating as the config is edited.

## 6. Validation

If the matched tier needs dimensions and they are empty, show "הזינו מידות" and no price. A 0×0 job is never priced — that is today's bug where it returns ₪60. `per_sheet` tiers require a quantity too.

## 7. Everything downstream reads the same config

- Curve chart: one fitted curve per tier, with markers at tier boundaries.
- Catalog: below-floor warnings use each item's own tier floor.
- Quantity-ladder generator ("צור סולם כמויות"): for `per_sheet` tiers, an editable 100 / 150 / 200 / 250 / 500 / 1000 list with computed prices and a copy button.
- No admin-only assumptions anywhere in the engine or the config reader.

## Verification

- מדבקות 5×5: qty 100 → ₪126, qty 150 → ₪134, qty 500 → ₪230 (matches the live site ladder).
- מדבקות 30×30 qty 1 → priced through the שמשונית reference, never below ₪70.
- שמשונית: 120×80 → ₪70, 400×200 → ₪800, 200×40 → ₪110.
- Empty size → no price, validation message shown.

## Technical notes

- New `src/lib/pricing.ts` holds the config types, tier matcher, methods, qty models, rounding and `priceJob`. `src/lib/mdvd.ts` keeps the anchor/curve helpers; `jobCost` and `costFloor` become thin wrappers over the engine so nothing breaks mid-refactor.
- Schema change: `pricing_config jsonb` on `families`, seeded by the same migration.
- Screens updated to call `priceJob`: `src/routes/calculator.tsx`, `src/routes/catalog.tsx`, `src/components/CurveChart.tsx`, and the family settings panel.
- Engine gets unit tests covering every verification case above, so the ladder numbers are checked automatically rather than by eye.
