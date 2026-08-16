# Family pricing: one method + one packages list

Each family's config collapses to a single שיטת תמחור selector plus a חבילות כמות list. Everything else disappears from the screen.

## 1. שיטת תמחור (one selector per family)

**א. לפי מ"ר** — שמשונית, PVC, קנבס
- דמי בסיס ₪ · ₪ למ"ר · מחיר מינימום ₪
- optional סף גודל (רוחב×גובה); when set, a second identical trio applies above the threshold
- collapsed extra: מינימום למטר אורך

**ב. משולב — גיליון עד גודל, מ"ר מעל** — מדבקות
- עד [רוחב]×[גובה] ס"מ (default 20×20): דמי הכנה ₪ · מחיר לגיליון ₪ · עלות גיליון ₪
  - units per sheet auto-computed from a 45×32 cm sheet with 0.5 cm gap, with a per-size override list
- מעל: דמי בסיס ₪ · ₪ למ"ר · מחיר מינימום ₪

Kept below, unchanged: עלות ייצור למ"ר / לגיליון and מקדם תקורה (one line, admin only). The old cost-driven margin fields, the customer/cost mode switch, and any leftover tier UI are removed from the screen.

## 2. חבילות כמות

A plain comma list per family (e.g. מדבקות: `100,150,200,250,500`). Empty = free quantity input, as today.

When set:
- The calculator replaces the free quantity field with a dropdown of the packages, each option showing its computed price (same UX as the website product page).
- "צור סולם כמויות" outputs exactly these packages with prices, copy-ready for iStores option lists and Senzey item creation.
- Sheet math prices each package as setup + sheets × price-per-sheet; per-m² families price a package as unit price × qty × quantity discount when defined.

## 3. Seeds

- **שמשונית** — לפי מ"ר: base 20, rate 52, min 40, min/meter 55; threshold 9999×160 with above = base 0, rate 100, min 0; packages empty.
- **מדבקות** — משולב: threshold 20×20; sheet הכנה 94, לגיליון 8, עלות 4, override 5×5 → 30; above rate 52 + base 20, min 70; packages 100,150,200,250,500; quantity coefficient forced to 1.

## 4. Verification (quick-test box)

| case | expected |
| --- | --- |
| מדבקות 5×5, package 100 | 126 |
| מדבקות 5×5, package 500 | 230 |
| מדבקות 8×8 (auto ~15/sheet), package 100 | ~150 |
| מדבקות 30×30 | ≥ 70 |
| שמשונית 120×80 | 70 |
| שמשונית 400×200 | 800 |
| שמשונית 200×40 | 110 |
| empty size | הזינו מידות |

Each case is checked in the quick-test box after the change. The ⌀8 ladder is also generated and compared against the site's current 148/157/172/192/270 to surface the loss-zone prices.

## Technical notes

- `families.pricing_config` stays the storage format; no schema change. Its `customer` block gains `method: "area" | "sheet_area"`, `packages: number[]`, and the sheet block keeps `setup`, `price_per_sheet`, `cost_per_sheet`, `overrides`, with `units_per_sheet` computed from sheet 45×32 / gap 0.5 instead of stored.
- `src/lib/mdvd.ts`: add `unitsPerSheet(w, h, overrides)` and rewrite `priceFromConfig` around the two methods; keep `fitsInBox`, `jobCost`, `costFloor`, `applyRounding` and the anchor/power-curve path as-is. Retire `priceFromCost` and the `mode`/`margin_pct` path once no caller remains.
- `src/routes/calculator.tsx`: replace the current cost/margin pricing block with the method selector, the method-specific field group, the packages input, and the packages dropdown in the main quantity field; wire "צור סולם כמויות" to the packages list.
- One data migration writes the שמשונית and מדבקות seeds above into `pricing_config`.
