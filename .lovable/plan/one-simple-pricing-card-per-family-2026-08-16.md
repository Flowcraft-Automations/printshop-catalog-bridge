# One simple pricing card per family

Back to the way שמשונית was set up: one size threshold, and the production cost before and after it. No tiers, no methods, no sheet math on screen.

## What the settings card shows

```text
תמחור «שמשונית»

מחיר ללקוח
  ₪ למ״ר            52
  מחיר מינימום       70

סף גודל
  רוחב (ס״מ) 150    גובה (ס״מ) 160
  מעל המידה הזו ההדפסה יוצאת למיקור חוץ

עלות ייצור
  לפני הסף  ₪ למ״ר   20
  אחרי הסף  ₪ למ״ר   80
  מקדם תקורה         1.5

עיגול מחיר   [לעגל ל-5 ₪]
הנחת כמות    10 יח׳ → 15%   20 יח׳ → 25%     [+ הוסף שורה]

בדיקה מהירה: רוחב · גובה · כמות → מחיר + משפט הסבר
```

That is the whole screen. Eight numbers, one dropdown, one discount table.

## Families that price by sheet

מדבקות needs the sheet option, so the card keeps a single choice at the top: **לפי גודל** or **לפי גיליון**. Picking גיליון swaps the price block for two numbers only — מחיר גיליון ללקוח and עלות גיליון — and keeps the same size threshold, above which the family prices by size like שמשונית (with its own minimum). Nothing else appears.

"כמו משפחה אחרת" is removed from the simple card; a family that copies another is expressed by just typing the same numbers, and the existing reference config still runs unchanged in advanced mode.

## Advanced mode

"הגדרות מתקדמות" still opens today's full tier editor, untouched, for the rare case. If a family's saved config can't be shown as one threshold (more than two bands, or per-running-meter), the card says so and opens advanced automatically.

## Technical notes

- `src/components/pricing/SimpleFamilyPricing.tsx` is rewritten as a flat form over at most two tiers:
  - tier A: `match { max_w, max_h }` = threshold, method `area_linear` (or `per_sheet`), `cost.cost_per_m2` = "before" cost.
  - tier B: `match {}`, method `area_linear`, `cost.cost_per_m2` = "after" cost, `params.min` = minimum.
  - Single-tier families (no threshold) render tier A only with the threshold fields blank.
- Overhead multiplier moves onto the card as "מקדם תקורה" (`cost.overhead_mult`); rounding and qty tiers stay as they are today.
- `isSimpleConfig` tightens to: ≤2 tiers, no `per_running_meter`, no `reference`, last tier is the catch-all, threshold expressed on both `max_w`/`max_h`.
- No engine change (`src/lib/pricing.ts`), no schema change, no change to the calculator's pricing path — only the settings UI.
