# Simplify family pricing to two shapes

Each family picks one method, and the screen shows only that method's fields. Nothing else is rendered.

## שמשונית — לפי מ"ר

One threshold (width × height) and two identical trios:

- בתוך הסף: דמי בסיס ₪ · ₪ למ"ר · מחיר מינימום ₪
- מעל הסף: same three fields
- עלות ייצור: ₪ למ"ר בתוך הסף · ₪ למ"ר מעל הסף
- מקדם תקורה (×), shared

Collapsed under "אפשרויות נוספות": מינימום למטר אורך. Packages list stays available but is normally empty, so the calculator keeps a free quantity field.

## מדבקות — משולב (גיליון / עמוד)

Threshold defaults to 20×20 ס"מ.

**Below the threshold — printed several per sheet**

- Sheet is 45×32 ס"מ, gap 0.5; יחידות בגיליון computed automatically, with a manual override list (5×5 → 30)
- דמי הכנה ₪ · מחיר לגיליון ₪ · עלות ייצור לגיליון ₪ (fixed, e.g. 4)
- Price = דמי הכנה + גיליונות × מחיר לגיליון, where גיליונות = ceil(quantity ÷ units per sheet)
- חבילות כמות (100,150,200,250,500): the calculator shows a dropdown of these with the computed price on each
- **מחירי עוגן**: a small list of size + package → price. When a row matches, that price wins over the formula; everything else stays formula-driven

**Above the threshold — one item per page, printed outside**

- עלות לעמוד ₪ (e.g. 80) · מחיר מינימום ₪
- Price = עלות לעמוד × כמות × מקדם תקורה, floored by the minimum
- The base + ₪/m² trio is not shown for this method

## What disappears from the screen

- לפי מ"ר: the whole sheet block, sheet overrides, sheet cost, and the page-cost line
- משולב: the "בתוך הסף" base/rate/min trio, ₪ למ"ר fields, מינימום למטר אורך, and עלות ייצור למ"ר

## Seeds

- **שמשונית** — לפי מ"ר: threshold 9999×160; below base 20, rate 52, min 40, min per linear meter 55; above base 0, rate 100, min 0; packages empty.
- **מדבקות** — משולב: threshold 20×20; sheet הכנה 94, לגיליון 8, עלות לגיליון 4, override 5×5 → 30; above עלות לעמוד 80, min 70; packages 100,150,200,250,500; מקדם כמות = 1.

## Verification in the quick-test box

| case | expected |
| --- | --- |
| מדבקות 5×5, חבילה 100 | 126 |
| מדבקות 5×5, חבילה 500 | 230 |
| מדבקות 8×8 (auto ~15 לגיליון), חבילה 100 | ~150 |
| מדבקות 30×30, כמות 1 | 80 × תקורה, לא פחות מ‑70 |
| שמשונית 120×80 | 70 |
| שמשונית 400×200 | 800 |
| שמשונית 200×40 | 110 |

## Technical notes

- Storage stays `families.pricing_config.customer`; no schema change. The block gains `above_page_cost`, `above_min`, and `anchors: [{ size, qty, price }]`, and drops nothing that existing rows rely on (readers fill defaults).
- `src/lib/mdvd.ts`: `priceFromConfig` branches by method. `sheet_area` above the threshold becomes `page_cost × qty × overhead` instead of the area trio, so the function needs the overhead factor passed in. Anchor lookup runs first for `sheet_area` below the threshold.
- `src/routes/calculator.tsx`: the admin config section renders one of two field groups keyed off `cust.method`; the shared footer keeps packages, rounding, overhead, and מקדם כמות. The ladder generator and package dropdown are unchanged apart from picking up anchor overrides.
- One data migration writes the two seeds above.
