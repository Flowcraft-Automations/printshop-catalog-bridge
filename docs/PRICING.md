# תמחור MDVD — הכללים לפי משפחה

נוצר אוטומטית מ-`src/lib/pricing-defaults.ts` (`bun run scripts/pricing-doc.ts`). זהו מקור האמת: מה שמופיע כאן הוא מה שהמחשבון מחשב אחרי הפעלת המיגרציה. הקטלוג (`products`) אינו נערך על ידי הקוד — הוא יומן ידני של מה שיש באתר ובסנזי.

## מקרי הלקוח (בדיקת קבלה)

| משפחה | מידה | כמות | מחיר | כלל | מקור |
|---|---|---|---|---|---|
| מדבקות | 30×20 | 1 | ₪20 | sheet | 9/8 12:10, 9/9 07:39 — fits the small sheet = ₪20 |
| מדבקות | 10×10 | 1 | ₪20 | sheet | 9/9 07:40 — 1/2/3/4 stickers = ₪20 |
| מדבקות | 10×10 | 3 | ₪20 | sheet | 9/9 07:40 |
| מדבקות | 10×10 | 9 | ₪40 | sheet | 8 per sheet → 2 sheets |
| מדבקות | 10×10 | 22 | ₪60 | sheet | 8/23 10:36 (≈₪70 quoted) → 3 sheets |
| מדבקות | 14×11 | 22 | ₪60 | sheet | 8 per sheet → 3 sheets |
| מדבקות | 45×30 | 1 | ₪20 | sheet | 8/23 11:23, 8/31 11:15 — 45/30 is the printable area |
| מדבקות | 40×30 | 1 | ₪20 | sheet | 8/31 11:15 |
| מדבקות | 5×5 | 50 | ₪63 | curve | Q1 default — pro-rata of the 100-pack (126) above 2 sheets (40) |
| מדבקות | 17×17 | 80 | ₪287 | package_min | Q1 default — never above the 100-pack (site 270 for 80) |
| מדבקות | 5×5 | 100 | ₪126 | validated | catalog pack |
| מדבקות | 5×5 | 1000 | ₪345 | validated | catalog pack |
| מדבקות | 3×3 | 1000 | ₪315 | validated | catalog pack |
| מדבקות | 40×40 | 1 | ₪20 | large_format | 9/23 Michelle — 0.16 m² must not cost the same as a square metre |
| מדבקות | 50×50 | 4 | ₪95 | large_format | 9/23 Michelle — four of them are a square metre = ₪95 |
| מדבקות | 100×100 | 1 | ₪95 | large_format | 9/23 — a square metre is a square metre, whatever its shape |
| מדבקות | 35×35 | 1 | ₪20 | large_format | job minimum = one small page |
| מדבקות | 35×35 | 4 | ₪47 | large_format | 0.49 m² × ₪95 |
| מדבקות | 46×30 | 1 | ₪20 | large_format | just over the small page — same price as a page, never less |
| מדבקות | 46×30 | 10 | ₪130 | large_format | 1.38 m² × ₪95 |
| מדבקות | 70×50 | 1 | ₪33 | large_format | 0.35 m² × ₪95 (site says ₪100 — Yulia updates it) |
| מדבקות | 70×50 | 2 | ₪67 | large_format | 0.70 m² × ₪95 |
| מדבקות | 80×60 | 1 | ₪46 | large_format | 0.48 m² × ₪95 (site ₪105) |
| מדבקות | 120×80 | 1 | ₪91 | large_format | 0.96 m² × ₪95 (site ₪120) |
| מדבקות | 130×130 | 1 | ₪160 | large_format | 1.69 m² × ₪95, split in two above 120 (9/3) — site ₪155 |
| מדבקות | 140×140 | 1 | ₪185 | large_format | 1.96 m² × ₪95 (site ₪180) |
| מדבקות | 110×100 | 1 | ₪105 | large_format | 1.1 m² × ₪95 |
| מדבקות | 140×100 | 1 | ₪135 | large_format | no step left at 1.5 m²: 1.4 m² × ₪95 |
| מדבקות | 150×100 | 1 | ₪145 | large_format | 1.5 m² × ₪95 — dearer than 1.4 m², as it should be |
| מדבקות | 115×8 | 10 | ₪87 | large_format | 0.92 m² × ₪95 — one job, one area |
| מדבקות | 160×160 | 1 | blocked |  | cap 150 |
| מדבקות | 10×15 | 1000 | ₪910 | cost_floor | 9/23 Gena — 250 pages cost him ₪700; the site sells it at ₪590 |
| מדבקות | 10×15 | 500 | ₪455 | cost_floor | 125 pages cost ₪350; the site sells it at ₪340 |
| מדבקות | 10×15 | 250 | ₪242 | validated | 63 pages cost ₪176 — the site price stands |
| שמשונית | 120×10 | 1 | ₪70 | package_min | 8/23 10:36 — minimum ₪70 |
| שמשונית | 60×40 | 1 | ₪70 |  | approved anchor = minimum |
| שמשונית | 120×80 | 1 | ₪90 |  | approved anchor (SPEC_ANCHORS) |
| שמשונית | 300×100 | 1 | ₪170 | validated | live is_anchor row (site price) |
| שמשונית | 160×160 | 1 | ₪205 | outsourced | 8/31 — flat ₪80/m² above 150 (2.56 m²) |
| שמשונית | 200×200 | 1 | ₪320 | outsourced | 8/31 12:03 → 9/1 07:32 — 4 m² × ₪80 |
| שמשונית | 300×200 | 1 | ₪480 | outsourced | 6 m² × ₪80 |
| שמשונית | 400×200 | 1 | ₪640 | outsourced | 8 m² × ₪80 |
| שמשונית | 400×200 {"withSeam":true} | 1 | ₪575 |  | with seam: welded in-house, 8 m² × ₪72 |
| שמשונית | 120×80 | 10 | ₪815 | curve | the ₪470 10-pack is פוליגל's; 10 × ₪81.6 |
| פוליגל | 40×40 | 1 | ₪90 | package_min | 8/18 10:59 — singles ₪90 |
| פוליגל | 60×40 | 1 | ₪90 | package_min | 8/18 10:59 — singles ₪90 |
| פוליגל | 120×80 | 1 | ₪90 | package_min | 8/18 — same as 60×40 (Natali) |
| פוליגל | 120×80 | 5 | ₪259 | short_run | Q5 default — linear from ₪90 to the ₪470 pack |
| פוליגל | 100×80 | 10 | ₪470 | tier | 10 signs up to 120×80 = ₪470 |
| פוליגל | 120×80 | 10 | ₪470 | tier | March campaign — 10 × 120/80 = ₪470 |
| פוליגל | 40×40 | 10 | ₪295 | tier | catalog pack |
| פוליגל | 150×100 | 1 | ₪120 | curve | Q5/Q6 default — ₪80/m² in-house |
| פוליגל | 200×100 | 1 | ₪160 | curve | 9/3 — up to 150 wide in-house |
| פוליגל | 160×160 | 1 | ₪205 | outsourced | Q6 default — ₪80/m² outsourced |
| שלטי PVC | 20×30 | 1 | ₪35 |  | 8/19 catalog |
| שלטי PVC | 30×60 | 1 | ₪60 |  | 8/19 catalog |
| שלטי PVC | 30×80 | 1 | ₪80 |  | 8/19 catalog |
| שלטי PVC | 40×60 | 1 | ₪70 |  | 8/19 catalog |
| שלטי PVC | 60×40 | 1 | ₪70 |  | 8/19 catalog (orientation) |
| פליירים | 15×21 | 500 | ₪232 | anchor | 8/23 08:49 — site price, 'don't forget this one' |
| פליירים | 15×21 {"dualSided":true} | 500 | ₪232 |  | 8/24 10:15 — single = double sided |
| פליירים | 15×21 | 10000 | ₪1093 |  | 8/25 — works |

## פליירים

**מנוע:** עקומת עוגנים · **קטלוג:** כל שורה מאומתת בקטלוג קובעת מחיר

**איך נקבע המחיר:**

1. מחיר מאומת בקטלוג לאותה מידה ולאותה כמות נלקח כמות שהוא — לפני כל חישוב
1. עקומת עוגנים: מחיר בסיס לפי דלי גודל × מקדם כמות (4 דליים)
1. משקל נייר משנה את המחיר: 170 גר׳ +8%
1. המחיר לעולם אינו נמוך ממידה מאושרת קטנה יותר (בשני הממדים) באותה כמות — הרצפה הופכת למחיר
1. לבסוף המחיר מעוגל: עד ₪20 לחצי שקל · עד ₪100 לשקל · מעל ₪100 לחמישה שקלים

**הגדרות בתוקף:** מנוע תמחור: עקומת עוגנים · שטח הדפסה: 45×32 ס״מ

<details><summary>התצורה המלאה (pricing_config.v3)</summary>

```json
{
  "engine": "anchor_curve",
  "method": "sheet",
  "margin": 1.3,
  "rounding": 1,
  "packages": [
    10,
    50,
    100,
    250,
    500,
    1000,
    2000,
    5000,
    10000,
    20000
  ],
  "min_unit_area": 1,
  "short_run_pct": 1,
  "qty_exponent": null,
  "qty_tiers_enabled": false,
  "qty_tiers": [],
  "sheet_units": {},
  "sheet_w": 45,
  "sheet_h": 32,
  "sheet_margin": 0,
  "sheet_gap": 0.5,
  "min_order_qty": 0,
  "max_print_w": 0,
  "max_print_l": 0,
  "over_limit": "weld",
  "mount_cost_m2": 0,
  "mount_cost_unit": 0,
  "cap_w": 0,
  "cap_l": 0,
  "whole_board": false,
  "board_w": 0,
  "board_h": 0,
  "plan": null,
  "short_run_ref_qty": 10,
  "min_order_value": 0,
  "dual_surcharge": [],
  "outsourced_margin_factor": 1.5,
  "outsourced_vat_incl": null,
  "paper_weight_pct": {
    "170": 0.08
  },
  "size_buckets": [
    {
      "id": "10/15",
      "max_w": 10,
      "max_h": 15,
      "factor": 0.835,
      "base100": null,
      "quote_only": false,
      "includes": []
    },
    {
      "id": "A5",
      "max_w": 15,
      "max_h": 21,
      "factor": 1,
      "base100": null,
      "quote_only": false,
      "includes": []
    },
    {
      "id": "A4",
      "max_w": 21,
      "max_h": 30,
      "factor": 1.8,
      "base100": null,
      "quote_only": false,
      "includes": []
    },
    {
      "id": "A3",
      "max_w": 30,
      "max_h": 42,
      "factor": 3.24,
      "base100": null,
      "quote_only": true,
      "includes": []
    }
  ],
  "qty_multipliers": [],
  "curve_anchors": [
    {
      "size": "A5",
      "qty": 10,
      "price": 75
    },
    {
      "size": "A5",
      "qty": 50,
      "price": 85
    },
    {
      "size": "A5",
      "qty": 100,
      "price": 95
    },
    {
      "size": "A5",
      "qty": 250,
      "price": 140
    },
    {
      "size": "A5",
      "qty": 500,
      "price": 232
    },
    {
      "size": "A5",
      "qty": 1000,
      "price": 395
    },
    {
      "size": "A5",
      "qty": 2000,
      "price": 475
    },
    {
      "size": "A5",
      "qty": 3000,
      "price": 535
    },
    {
      "size": "A5",
      "qty": 5000,
      "price": 600
    },
    {
      "size": "A5",
      "qty": 10000,
      "price": 1093
    },
    {
      "size": "A5",
      "qty": 12000,
      "price": 1250
    },
    {
      "size": "A5",
      "qty": 20000,
      "price": 1600
    },
    {
      "size": "10/15",
      "qty": 1000,
      "price": 330
    },
    {
      "size": "A4",
      "qty": 1000,
      "price": 710
    }
  ],
  "tail_per_unit": 0.05,
  "per_m2_tiers": [],
  "min_job_price": 0,
  "size_ladder": [],
  "panoramic_aspect": 0,
  "panoramic_pct": 0,
  "yield_table": [],
  "vinyl_cost_sheet": 0,
  "format_prices": [],
  "digital_setup": 72,
  "digital_per_unit": 0.32,
  "digital_max_qty": 1000,
  "todos": [],
  "catalog_binds": "all",
  "sheet_price": 0,
  "outsourced_rate_m2": 0
}
```

</details>

## מדבקות

**מנוע:** שתי מדפסות — דף קטן / דף גדול · **קטלוג:** חבילות (מכמות החבילה הקטנה) ומדבקות שאינן נכנסות לדף הקטן קובעות מחיר; בודדים בדף הקטן — לפי הדף

**איך נקבע המחיר:**

1. מחיר מאומת בקטלוג נלקח כמות שהוא לחבילות (מ-100 יח׳) ולמדבקות שאינן נכנסות לדף הקטן (45.8×30 ס״מ); מדבקה בודדת שנכנסת לדף הקטן מתומחרת לפי הדף
1. שתי מדפסות. מדבקה שנכנסת לדף הקטן (45.8×30 ס״מ) מתומחרת לפי דפים — ₪20 לדף לפי כמה מדבקות נכנסות בדף — ולעולם לא יותר מחבילת 100 היחידות של דלי הגודל; מ-100 יחידות המחיר הוא מחירי החבילות של האתר. מדבקה שאינה נכנסת לדף הקטן מודפסת במדפסת הגדולה (דף גדול) לפי מ״ר — השטח נספר על כל היחידות יחד (0+ מ״ר → ₪95), ומינימום ₪20 נגבה פעם אחת לעבודה
1. רוחב הדפסה מרבי 120 ס״מ · מידה רחבה מ-120 ס״מ מסופקת בכמה חלקים — אותו מחיר, כי שטח החומר זהה · גבול ייצור מוחלט 150 ס״מ
1. המחיר לעולם אינו נמוך ממידה מאושרת קטנה יותר (בשני הממדים) באותה כמות — הרצפה הופכת למחיר
1. המחיר לעולם אינו נמוך מעלות הייצור × מקדם הרווח (1.3) — הרצפה הופכת למחיר
1. לבסוף המחיר מעוגל: עד ₪20 לחצי שקל · עד ₪100 לשקל · מעל ₪100 לחמישה שקלים

**הגדרות בתוקף:** מנוע תמחור: שתי מדפסות — דף קטן / דף גדול · רוחב הדפסה: 120 ס״מ · גבול ייצור: 150×∞ ס״מ · שטח הדף הקטן: 45.8×30 ס״מ · דף קטן: ₪20 · חבילות מ-100 יח׳ · מדפסת גדולה: מינימום ₪20 לעבודה

<details><summary>התצורה המלאה (pricing_config.v3)</summary>

```json
{
  "engine": "two_machine_sheet",
  "method": "sheet",
  "margin": 1.3,
  "rounding": 1,
  "packages": [
    100,
    150,
    200,
    250,
    500,
    1000
  ],
  "min_unit_area": 1,
  "short_run_pct": 0.7,
  "qty_exponent": null,
  "qty_tiers_enabled": false,
  "qty_tiers": [],
  "sheet_units": {
    "5x5": 30
  },
  "sheet_w": 48.8,
  "sheet_h": 33,
  "sheet_margin": 1.5,
  "sheet_gap": 0.5,
  "min_order_qty": 0,
  "max_print_w": 120,
  "max_print_l": 0,
  "over_limit": "weld",
  "mount_cost_m2": 0,
  "mount_cost_unit": 0,
  "cap_w": 150,
  "cap_l": 0,
  "whole_board": false,
  "board_w": 0,
  "board_h": 0,
  "plan": {
    "modifiers": [
      {
        "kind": "cost_floor"
      }
    ]
  },
  "short_run_ref_qty": 100,
  "min_order_value": 0,
  "dual_surcharge": [],
  "outsourced_margin_factor": 1.35,
  "outsourced_vat_incl": null,
  "paper_weight_pct": {},
  "size_buckets": [
    {
      "id": "3",
      "max_w": 3,
      "max_h": 3,
      "factor": null,
      "base100": 115,
      "quote_only": false,
      "includes": []
    },
    {
      "id": "4",
      "max_w": 4,
      "max_h": 4,
      "factor": null,
      "base100": 121,
      "quote_only": false,
      "includes": []
    },
    {
      "id": "5",
      "max_w": 5,
      "max_h": 5,
      "factor": null,
      "base100": 126,
      "quote_only": false,
      "includes": [
        "8x5"
      ]
    },
    {
      "id": "6",
      "max_w": 6,
      "max_h": 6,
      "factor": null,
      "base100": 137,
      "quote_only": false,
      "includes": []
    },
    {
      "id": "8",
      "max_w": 8,
      "max_h": 8,
      "factor": null,
      "base100": 148,
      "quote_only": false,
      "includes": []
    },
    {
      "id": "9",
      "max_w": 9,
      "max_h": 9,
      "factor": null,
      "base100": 154,
      "quote_only": false,
      "includes": []
    },
    {
      "id": "24x12",
      "max_w": 24,
      "max_h": 12,
      "factor": null,
      "base100": 187,
      "quote_only": false,
      "includes": []
    },
    {
      "id": "42x20",
      "max_w": 42,
      "max_h": 20,
      "factor": null,
      "base100": 287,
      "quote_only": false,
      "includes": []
    }
  ],
  "qty_multipliers": [
    {
      "qty": 100,
      "mult": 1
    },
    {
      "qty": 150,
      "mult": 1.06
    },
    {
      "qty": 200,
      "mult": 1.163
    },
    {
      "qty": 250,
      "mult": 1.295
    },
    {
      "qty": 500,
      "mult": 1.832
    },
    {
      "qty": 1000,
      "mult": 3.049
    }
  ],
  "curve_anchors": [],
  "tail_per_unit": null,
  "per_m2_tiers": [
    {
      "min_m2": 0,
      "rate": 95
    }
  ],
  "min_job_price": 20,
  "size_ladder": [],
  "panoramic_aspect": 0,
  "panoramic_pct": 0,
  "yield_table": [],
  "vinyl_cost_sheet": 0,
  "format_prices": [],
  "digital_setup": 0,
  "digital_per_unit": 0,
  "digital_max_qty": 0,
  "todos": [],
  "catalog_binds": "packs",
  "sheet_price": 20,
  "outsourced_rate_m2": 0
}
```

</details>

## שמשונית

**מנוע:** לפי מ״ר · **קטלוג:** רק שורות שסומנו ⚓ (עוגן) קובעות מחיר

**איך נקבע המחיר:**

1. רק שורה שסומנה כעוגן ⚓ בקטלוג, לאותה מידה ולאותה כמות, נלקחת כמות שהיא — לפני כל חישוב; שאר השורות המאומתות משמשות להשוואה
1. לפי מ״ר: 0+ מ״ר → ₪85 · 2+ מ״ר → ₪75 · 4+ מ״ר → ₪72 · מינימום ₪70 ליחידה
1. רוחב הדפסה מרבי 150 ס״מ · מידה שצידה הצר רחב מ-150 ס״מ מיוצרת בייצור חוץ — ₪80 למ״ר, מינימום ₪70 (עם תפר: ריתוך פאנלים בבית)
1. המחיר לעולם אינו נמוך ממידה מאושרת קטנה יותר (בשני הממדים) באותה כמות — הרצפה הופכת למחיר
1. לבסוף המחיר מעוגל: עד ₪20 לחצי שקל · עד ₪100 לשקל · מעל ₪100 לחמישה שקלים

**הגדרות בתוקף:** מנוע תמחור: לפי מ״ר · רוחב הדפסה: 150 ס״מ · ייצור חוץ: ₪80 למ״ר

<details><summary>התצורה המלאה (pricing_config.v3)</summary>

```json
{
  "engine": "per_m2",
  "method": "area",
  "margin": 1.3,
  "rounding": 1,
  "packages": [],
  "min_unit_area": 1,
  "short_run_pct": 0.7,
  "qty_exponent": null,
  "qty_tiers_enabled": false,
  "qty_tiers": [],
  "sheet_units": {},
  "sheet_w": 45,
  "sheet_h": 32,
  "sheet_margin": 0,
  "sheet_gap": 0.5,
  "min_order_qty": 0,
  "max_print_w": 150,
  "max_print_l": 0,
  "over_limit": "outsource",
  "mount_cost_m2": 0,
  "mount_cost_unit": 0,
  "cap_w": 0,
  "cap_l": 0,
  "whole_board": false,
  "board_w": 0,
  "board_h": 0,
  "plan": null,
  "short_run_ref_qty": 100,
  "min_order_value": 0,
  "dual_surcharge": [],
  "outsourced_margin_factor": 1.5,
  "outsourced_vat_incl": null,
  "paper_weight_pct": {},
  "size_buckets": [],
  "qty_multipliers": [],
  "curve_anchors": [],
  "tail_per_unit": null,
  "per_m2_tiers": [
    {
      "min_m2": 0,
      "rate": 85
    },
    {
      "min_m2": 2,
      "rate": 75
    },
    {
      "min_m2": 4,
      "rate": 72
    }
  ],
  "min_job_price": 70,
  "size_ladder": [],
  "panoramic_aspect": 0,
  "panoramic_pct": 0,
  "yield_table": [],
  "vinyl_cost_sheet": 0,
  "format_prices": [],
  "digital_setup": 0,
  "digital_per_unit": 0,
  "digital_max_qty": 0,
  "todos": [],
  "catalog_binds": "anchors",
  "sheet_price": 0,
  "outsourced_rate_m2": 80
}
```

</details>

## שלטי PVC

**מנוע:** סולם מידות · **קטלוג:** כל שורה מאומתת בקטלוג קובעת מחיר

**איך נקבע המחיר:**

1. מחיר מאומת בקטלוג לאותה מידה ולאותה כמות נלקח כמות שהוא — לפני כל חישוב
1. סולם מידות: 16 מידות מאושרות; מידה שאינה בסולם מתומחרת בין שתי השכנות לפי שטח
1. המחיר לעולם אינו נמוך ממידה מאושרת קטנה יותר (בשני הממדים) באותה כמות — הרצפה הופכת למחיר
1. לבסוף המחיר מעוגל: עד ₪20 לחצי שקל · עד ₪100 לשקל · מעל ₪100 לחמישה שקלים

**הגדרות בתוקף:** מנוע תמחור: סולם מידות · גבול ייצור: 150×300 ס״מ

<details><summary>התצורה המלאה (pricing_config.v3)</summary>

```json
{
  "engine": "size_ladder",
  "method": "area",
  "margin": 1.3,
  "rounding": 1,
  "packages": [],
  "min_unit_area": 1,
  "short_run_pct": 0.7,
  "qty_exponent": null,
  "qty_tiers_enabled": false,
  "qty_tiers": [],
  "sheet_units": {},
  "sheet_w": 45,
  "sheet_h": 32,
  "sheet_margin": 0,
  "sheet_gap": 0.5,
  "min_order_qty": 0,
  "max_print_w": 0,
  "max_print_l": 0,
  "over_limit": "block",
  "mount_cost_m2": 0,
  "mount_cost_unit": 0,
  "cap_w": 150,
  "cap_l": 300,
  "whole_board": false,
  "board_w": 0,
  "board_h": 0,
  "plan": null,
  "short_run_ref_qty": 100,
  "min_order_value": 0,
  "dual_surcharge": [],
  "outsourced_margin_factor": 1.5,
  "outsourced_vat_incl": null,
  "paper_weight_pct": {},
  "size_buckets": [],
  "qty_multipliers": [],
  "curve_anchors": [],
  "tail_per_unit": null,
  "per_m2_tiers": [],
  "min_job_price": 0,
  "size_ladder": [
    {
      "w": 20,
      "h": 30,
      "price": 35
    },
    {
      "w": 30,
      "h": 40,
      "price": 40
    },
    {
      "w": 30,
      "h": 60,
      "price": 60
    },
    {
      "w": 40,
      "h": 60,
      "price": 70
    },
    {
      "w": 50,
      "h": 50,
      "price": 80
    },
    {
      "w": 30,
      "h": 80,
      "price": 80
    },
    {
      "w": 30,
      "h": 90,
      "price": 90
    },
    {
      "w": 50,
      "h": 70,
      "price": 100
    },
    {
      "w": 100,
      "h": 40,
      "price": 115
    },
    {
      "w": 50,
      "h": 100,
      "price": 145
    },
    {
      "w": 60,
      "h": 90,
      "price": 150
    },
    {
      "w": 100,
      "h": 70,
      "price": 155
    },
    {
      "w": 70,
      "h": 140,
      "price": 200
    },
    {
      "w": 120,
      "h": 80,
      "price": 200
    },
    {
      "w": 100,
      "h": 150,
      "price": 300
    },
    {
      "w": 80,
      "h": 200,
      "price": 350
    }
  ],
  "panoramic_aspect": 0,
  "panoramic_pct": 0,
  "yield_table": [],
  "vinyl_cost_sheet": 0,
  "format_prices": [],
  "digital_setup": 0,
  "digital_per_unit": 0,
  "digital_max_qty": 0,
  "todos": [],
  "catalog_binds": "all",
  "sheet_price": 0,
  "outsourced_rate_m2": 0
}
```

</details>

## פוליגל

**מנוע:** לפי מ״ר · **קטלוג:** הקטלוג אינו קובע מחיר — נוסחה בלבד

**איך נקבע המחיר:**

1. הקטלוג אינו קובע מחיר למשפחה זו — המחיר מחושב מהנוסחה בלבד; השורות המאומתות מוצגות להשוואה
1. לפי מ״ר: 0+ מ״ר → ₪80 · מינימום ₪90 ליחידה
1. רוחב הדפסה מרבי 150 ס״מ · מידה שצידה הצר רחב מ-150 ס״מ מיוצרת בייצור חוץ — ₪80 למ״ר, מינימום ₪90 (עם תפר: ריתוך פאנלים בבית)
1. המחיר לעולם אינו נמוך ממידה מאושרת קטנה יותר (בשני הממדים) באותה כמות — הרצפה הופכת למחיר
1. לבסוף המחיר מעוגל: עד ₪20 לחצי שקל · עד ₪100 לשקל · מעל ₪100 לחמישה שקלים

**הגדרות בתוקף:** מנוע תמחור: לפי מ״ר · רוחב הדפסה: 150 ס״מ · ייצור חוץ: ₪80 למ״ר

<details><summary>התצורה המלאה (pricing_config.v3)</summary>

```json
{
  "engine": "per_m2",
  "method": "area",
  "margin": 1.3,
  "rounding": 1,
  "packages": [],
  "min_unit_area": 1,
  "short_run_pct": 0.7,
  "qty_exponent": null,
  "qty_tiers_enabled": true,
  "qty_tiers": [
    {
      "min_qty": 10,
      "unit_price": 47,
      "size": "120x80"
    },
    {
      "min_qty": 10,
      "unit_price": 29.5,
      "size": "40x40"
    }
  ],
  "sheet_units": {},
  "sheet_w": 45,
  "sheet_h": 32,
  "sheet_margin": 0,
  "sheet_gap": 0.5,
  "min_order_qty": 0,
  "max_print_w": 150,
  "max_print_l": 0,
  "over_limit": "outsource",
  "mount_cost_m2": 0,
  "mount_cost_unit": 0,
  "cap_w": 0,
  "cap_l": 0,
  "whole_board": false,
  "board_w": 0,
  "board_h": 0,
  "plan": null,
  "short_run_ref_qty": 100,
  "min_order_value": 0,
  "dual_surcharge": [],
  "outsourced_margin_factor": 1.5,
  "outsourced_vat_incl": null,
  "paper_weight_pct": {},
  "size_buckets": [],
  "qty_multipliers": [],
  "curve_anchors": [],
  "tail_per_unit": null,
  "per_m2_tiers": [
    {
      "min_m2": 0,
      "rate": 80
    }
  ],
  "min_job_price": 90,
  "size_ladder": [],
  "panoramic_aspect": 0,
  "panoramic_pct": 0,
  "yield_table": [],
  "vinyl_cost_sheet": 0,
  "format_prices": [],
  "digital_setup": 0,
  "digital_per_unit": 0,
  "digital_max_qty": 0,
  "todos": [],
  "catalog_binds": "none",
  "sheet_price": 0,
  "outsourced_rate_m2": 80
}
```

</details>

## קנבס

**מנוע:** סולם מידות · **קטלוג:** כל שורה מאומתת בקטלוג קובעת מחיר

**איך נקבע המחיר:**

1. מחיר מאומת בקטלוג לאותה מידה ולאותה כמות נלקח כמות שהוא — לפני כל חישוב
1. סולם מידות: 16 מידות מאושרות; מידה שאינה בסולם מתומחרת בין שתי השכנות לפי שטח
1. רוחב הדפסה מרבי 140 ס״מ · מידה רחבה מ-140 ס״מ אינה מיוצרת · גבול ייצור מוחלט 140 ס״מ
1. המחיר לעולם אינו נמוך ממידה מאושרת קטנה יותר (בשני הממדים) באותה כמות — הרצפה הופכת למחיר
1. לבסוף המחיר מעוגל: עד ₪20 לחצי שקל · עד ₪100 לשקל · מעל ₪100 לחמישה שקלים

**הגדרות בתוקף:** מנוע תמחור: סולם מידות · רוחב הדפסה: 140 ס״מ · גבול ייצור: 140×200 ס״מ

<details><summary>התצורה המלאה (pricing_config.v3)</summary>

```json
{
  "engine": "size_ladder",
  "method": "area",
  "margin": 1.3,
  "rounding": 1,
  "packages": [],
  "min_unit_area": 1,
  "short_run_pct": 0.7,
  "qty_exponent": null,
  "qty_tiers_enabled": false,
  "qty_tiers": [],
  "sheet_units": {},
  "sheet_w": 45,
  "sheet_h": 32,
  "sheet_margin": 0,
  "sheet_gap": 0.5,
  "min_order_qty": 0,
  "max_print_w": 140,
  "max_print_l": 200,
  "over_limit": "block",
  "mount_cost_m2": 0,
  "mount_cost_unit": 0,
  "cap_w": 140,
  "cap_l": 200,
  "whole_board": false,
  "board_w": 0,
  "board_h": 0,
  "plan": null,
  "short_run_ref_qty": 100,
  "min_order_value": 0,
  "dual_surcharge": [],
  "outsourced_margin_factor": 1.5,
  "outsourced_vat_incl": null,
  "paper_weight_pct": {},
  "size_buckets": [],
  "qty_multipliers": [],
  "curve_anchors": [],
  "tail_per_unit": null,
  "per_m2_tiers": [],
  "min_job_price": 0,
  "size_ladder": [
    {
      "w": 20,
      "h": 20,
      "price": 59
    },
    {
      "w": 30,
      "h": 30,
      "price": 95
    },
    {
      "w": 30,
      "h": 40,
      "price": 105
    },
    {
      "w": 30,
      "h": 45,
      "price": 110
    },
    {
      "w": 50,
      "h": 30,
      "price": 115
    },
    {
      "w": 30,
      "h": 60,
      "price": 120
    },
    {
      "w": 50,
      "h": 40,
      "price": 140
    },
    {
      "w": 50,
      "h": 75,
      "price": 159
    },
    {
      "w": 90,
      "h": 90,
      "price": 230
    },
    {
      "w": 100,
      "h": 70,
      "price": 245
    },
    {
      "w": 80,
      "h": 120,
      "price": 255
    },
    {
      "w": 70,
      "h": 140,
      "price": 281
    },
    {
      "w": 90,
      "h": 120,
      "price": 280
    },
    {
      "w": 120,
      "h": 100,
      "price": 310
    },
    {
      "w": 60,
      "h": 180,
      "price": 365
    },
    {
      "w": 150,
      "h": 100,
      "price": 385
    }
  ],
  "panoramic_aspect": 2.4,
  "panoramic_pct": 0.1,
  "yield_table": [],
  "vinyl_cost_sheet": 0,
  "format_prices": [],
  "digital_setup": 0,
  "digital_per_unit": 0,
  "digital_max_qty": 0,
  "todos": [],
  "catalog_binds": "all",
  "sheet_price": 0,
  "outsourced_rate_m2": 0
}
```

</details>

## זכוכית

**מנוע:** סולם מידות · **קטלוג:** כל שורה מאומתת בקטלוג קובעת מחיר

**איך נקבע המחיר:**

1. מחיר מאומת בקטלוג לאותה מידה ולאותה כמות נלקח כמות שהוא — לפני כל חישוב
1. סולם מידות: 3 מידות מאושרות; מידה שאינה בסולם מתומחרת בין שתי השכנות לפי שטח
1. המחיר לעולם אינו נמוך ממידה מאושרת קטנה יותר (בשני הממדים) באותה כמות — הרצפה הופכת למחיר
1. לבסוף המחיר מעוגל: עד ₪20 לחצי שקל · עד ₪100 לשקל · מעל ₪100 לחמישה שקלים

**הגדרות בתוקף:** מנוע תמחור: סולם מידות

<details><summary>התצורה המלאה (pricing_config.v3)</summary>

```json
{
  "engine": "size_ladder",
  "method": "area",
  "margin": 1.3,
  "rounding": 1,
  "packages": [],
  "min_unit_area": 1,
  "short_run_pct": 0.7,
  "qty_exponent": null,
  "qty_tiers_enabled": false,
  "qty_tiers": [],
  "sheet_units": {},
  "sheet_w": 45,
  "sheet_h": 32,
  "sheet_margin": 0,
  "sheet_gap": 0.5,
  "min_order_qty": 0,
  "max_print_w": 0,
  "max_print_l": 0,
  "over_limit": "weld",
  "mount_cost_m2": 0,
  "mount_cost_unit": 0,
  "cap_w": 0,
  "cap_l": 0,
  "whole_board": false,
  "board_w": 0,
  "board_h": 0,
  "plan": null,
  "short_run_ref_qty": 100,
  "min_order_value": 0,
  "dual_surcharge": [],
  "outsourced_margin_factor": 1.5,
  "outsourced_vat_incl": null,
  "paper_weight_pct": {},
  "size_buckets": [],
  "qty_multipliers": [],
  "curve_anchors": [],
  "tail_per_unit": null,
  "per_m2_tiers": [],
  "min_job_price": 0,
  "size_ladder": [
    {
      "w": 20,
      "h": 30,
      "price": 160
    },
    {
      "w": 100,
      "h": 70,
      "price": 675
    },
    {
      "w": 120,
      "h": 80,
      "price": 1035
    }
  ],
  "panoramic_aspect": 0,
  "panoramic_pct": 0,
  "yield_table": [],
  "vinyl_cost_sheet": 0,
  "format_prices": [],
  "digital_setup": 0,
  "digital_per_unit": 0,
  "digital_max_qty": 0,
  "todos": [],
  "catalog_binds": "all",
  "sheet_price": 0,
  "outsourced_rate_m2": 0
}
```

</details>

## קאפה

**מנוע:** תפוקת גיליון · **קטלוג:** כל שורה מאומתת בקטלוג קובעת מחיר

**איך נקבע המחיר:**

1. מחיר מאומת בקטלוג לאותה מידה ולאותה כמות נלקח כמות שהוא — לפני כל חישוב
1. תפוקת גיליון: כמה יחידות נכנסות בגיליון 240×120 ס״מ, ומחיר לפי מספר הגיליונות
1. רוחב הדפסה מרבי 60 ס״מ · מידה רחבה מ-60 ס״מ מודבקת על לוח · גבול ייצור מוחלט 120 ס״מ
1. המחיר לעולם אינו נמוך ממידה מאושרת קטנה יותר (בשני הממדים) באותה כמות — הרצפה הופכת למחיר
1. המחיר לעולם אינו נמוך מעלות הייצור × מקדם הרווח (1.3) — הרצפה הופכת למחיר
1. לבסוף המחיר מעוגל: עד ₪20 לחצי שקל · עד ₪100 לשקל · מעל ₪100 לחמישה שקלים

**הגדרות בתוקף:** מנוע תמחור: תפוקת גיליון · רוחב הדפסה: 60 ס״מ · גבול ייצור: 120×240 ס״מ · שטח הדפסה: 240×120 ס״מ

**פתוח:** קאפה: מחירי מדרגות תפוקה (יח׳ בגיליון) טרם אומתו מול הלקוח (TODO)

<details><summary>התצורה המלאה (pricing_config.v3)</summary>

```json
{
  "engine": "sheet_yield",
  "method": "area",
  "margin": 1.3,
  "rounding": 1,
  "packages": [],
  "min_unit_area": 1,
  "short_run_pct": 0.7,
  "qty_exponent": null,
  "qty_tiers_enabled": false,
  "qty_tiers": [],
  "sheet_units": {},
  "sheet_w": 240,
  "sheet_h": 120,
  "sheet_margin": 0,
  "sheet_gap": 0,
  "min_order_qty": 0,
  "max_print_w": 60,
  "max_print_l": 90,
  "over_limit": "mount",
  "mount_cost_m2": 0,
  "mount_cost_unit": 25,
  "cap_w": 120,
  "cap_l": 240,
  "whole_board": true,
  "board_w": 240,
  "board_h": 120,
  "plan": {
    "modifiers": [
      {
        "kind": "cost_floor"
      }
    ]
  },
  "short_run_ref_qty": 100,
  "min_order_value": 0,
  "dual_surcharge": [],
  "outsourced_margin_factor": 1.5,
  "outsourced_vat_incl": null,
  "paper_weight_pct": {},
  "size_buckets": [],
  "qty_multipliers": [],
  "curve_anchors": [],
  "tail_per_unit": null,
  "per_m2_tiers": [],
  "min_job_price": 0,
  "size_ladder": [],
  "panoramic_aspect": 0,
  "panoramic_pct": 0,
  "yield_table": [],
  "vinyl_cost_sheet": 6,
  "format_prices": [],
  "digital_setup": 0,
  "digital_per_unit": 0,
  "digital_max_qty": 0,
  "todos": [
    "קאפה: מחירי מדרגות תפוקה (יח׳ בגיליון) טרם אומתו מול הלקוח (TODO)"
  ],
  "catalog_binds": "all",
  "sheet_price": 0,
  "outsourced_rate_m2": 0
}
```

</details>

## חשבוניות

**מנוע:** מחיר רצפה · **קטלוג:** כל שורה מאומתת בקטלוג קובעת מחיר

**איך נקבע המחיר:**

1. מחיר מאומת בקטלוג לאותה מידה ולאותה כמות נלקח כמות שהוא — לפני כל חישוב
1. מחירי פורמט קבועים: 4 תצורות מאושרות
1. המחיר לעולם אינו נמוך ממידה מאושרת קטנה יותר (בשני הממדים) באותה כמות — הרצפה הופכת למחיר
1. לבסוף המחיר מעוגל: עד ₪20 לחצי שקל · עד ₪100 לשקל · מעל ₪100 לחמישה שקלים

**הגדרות בתוקף:** מנוע תמחור: מחיר רצפה

**פתוח:** חשבוניות: מספר סטים לפנקס (25/50) טרם אומת בסנזיי — המחיר עשוי להשתנות (TODO)

<details><summary>התצורה המלאה (pricing_config.v3)</summary>

```json
{
  "engine": "unit_floor",
  "method": "area",
  "margin": 1.3,
  "rounding": 1,
  "packages": [],
  "min_unit_area": 1,
  "short_run_pct": 0.7,
  "qty_exponent": null,
  "qty_tiers_enabled": false,
  "qty_tiers": [],
  "sheet_units": {},
  "sheet_w": 45,
  "sheet_h": 32,
  "sheet_margin": 0,
  "sheet_gap": 0.5,
  "min_order_qty": 0,
  "max_print_w": 0,
  "max_print_l": 0,
  "over_limit": "weld",
  "mount_cost_m2": 0,
  "mount_cost_unit": 0,
  "cap_w": 0,
  "cap_l": 0,
  "whole_board": false,
  "board_w": 0,
  "board_h": 0,
  "plan": null,
  "short_run_ref_qty": 100,
  "min_order_value": 0,
  "dual_surcharge": [],
  "outsourced_margin_factor": 1.5,
  "outsourced_vat_incl": null,
  "paper_weight_pct": {},
  "size_buckets": [],
  "qty_multipliers": [],
  "curve_anchors": [],
  "tail_per_unit": null,
  "per_m2_tiers": [],
  "min_job_price": 0,
  "size_ladder": [],
  "panoramic_aspect": 0,
  "panoramic_pct": 0,
  "yield_table": [],
  "vinyl_cost_sheet": 0,
  "format_prices": [
    {
      "label": "A5 × 10 פנקסים",
      "w": 14.8,
      "h": 21,
      "qty": 10,
      "price": 320
    },
    {
      "label": "שישיות × 10 פנקסים",
      "w": null,
      "h": null,
      "qty": 10,
      "price": 418
    },
    {
      "label": "A4 × 10 פנקסים",
      "w": 21,
      "h": 29.7,
      "qty": 10,
      "price": 418
    },
    {
      "label": "A4 × 20 פנקסים",
      "w": 21,
      "h": 29.7,
      "qty": 20,
      "price": 858
    }
  ],
  "digital_setup": 0,
  "digital_per_unit": 0,
  "digital_max_qty": 0,
  "todos": [
    "חשבוניות: מספר סטים לפנקס (25/50) טרם אומת בסנזיי — המחיר עשוי להשתנות (TODO)"
  ],
  "catalog_binds": "all",
  "sheet_price": 0,
  "outsourced_rate_m2": 0
}
```

</details>

## פנקסים

**מנוע:** מחיר רצפה · **קטלוג:** כל שורה מאומתת בקטלוג קובעת מחיר

**איך נקבע המחיר:**

1. מחיר מאומת בקטלוג לאותה מידה ולאותה כמות נלקח כמות שהוא — לפני כל חישוב
1. מחירי פורמט קבועים: 4 תצורות מאושרות
1. המחיר לעולם אינו נמוך ממידה מאושרת קטנה יותר (בשני הממדים) באותה כמות — הרצפה הופכת למחיר
1. לבסוף המחיר מעוגל: עד ₪20 לחצי שקל · עד ₪100 לשקל · מעל ₪100 לחמישה שקלים

**הגדרות בתוקף:** מנוע תמחור: מחיר רצפה

**פתוח:** חשבוניות: מספר סטים לפנקס (25/50) טרם אומת בסנזיי — המחיר עשוי להשתנות (TODO)

<details><summary>התצורה המלאה (pricing_config.v3)</summary>

```json
{
  "engine": "unit_floor",
  "method": "area",
  "margin": 1.3,
  "rounding": 1,
  "packages": [],
  "min_unit_area": 1,
  "short_run_pct": 0.7,
  "qty_exponent": null,
  "qty_tiers_enabled": false,
  "qty_tiers": [],
  "sheet_units": {},
  "sheet_w": 45,
  "sheet_h": 32,
  "sheet_margin": 0,
  "sheet_gap": 0.5,
  "min_order_qty": 0,
  "max_print_w": 0,
  "max_print_l": 0,
  "over_limit": "weld",
  "mount_cost_m2": 0,
  "mount_cost_unit": 0,
  "cap_w": 0,
  "cap_l": 0,
  "whole_board": false,
  "board_w": 0,
  "board_h": 0,
  "plan": null,
  "short_run_ref_qty": 100,
  "min_order_value": 0,
  "dual_surcharge": [],
  "outsourced_margin_factor": 1.5,
  "outsourced_vat_incl": null,
  "paper_weight_pct": {},
  "size_buckets": [],
  "qty_multipliers": [],
  "curve_anchors": [],
  "tail_per_unit": null,
  "per_m2_tiers": [],
  "min_job_price": 0,
  "size_ladder": [],
  "panoramic_aspect": 0,
  "panoramic_pct": 0,
  "yield_table": [],
  "vinyl_cost_sheet": 0,
  "format_prices": [
    {
      "label": "A5 × 10 פנקסים",
      "w": 14.8,
      "h": 21,
      "qty": 10,
      "price": 320
    },
    {
      "label": "שישיות × 10 פנקסים",
      "w": null,
      "h": null,
      "qty": 10,
      "price": 418
    },
    {
      "label": "A4 × 10 פנקסים",
      "w": 21,
      "h": 29.7,
      "qty": 10,
      "price": 418
    },
    {
      "label": "A4 × 20 פנקסים",
      "w": 21,
      "h": 29.7,
      "qty": 20,
      "price": 858
    }
  ],
  "digital_setup": 0,
  "digital_per_unit": 0,
  "digital_max_qty": 0,
  "todos": [
    "חשבוניות: מספר סטים לפנקס (25/50) טרם אומת בסנזיי — המחיר עשוי להשתנות (TODO)"
  ],
  "catalog_binds": "all",
  "sheet_price": 0,
  "outsourced_rate_m2": 0
}
```

</details>

## פרספקס

**מנוע:** סולם מידות · **קטלוג:** כל שורה מאומתת בקטלוג קובעת מחיר

**איך נקבע המחיר:**

1. משפחה זו מתומחרת ידנית — כל מידה מוחזרת כהצעת מחיר, ללא מחיר אוטומטי

**פתוח:** פרספקס: אין עדיין עלויות ומחירים — כל מידה מוחזרת כהצעת מחיר (TODO לקוח)

<details><summary>התצורה המלאה (pricing_config.v3)</summary>

```json
{
  "engine": "size_ladder",
  "method": "area",
  "margin": 1.3,
  "rounding": 1,
  "packages": [],
  "min_unit_area": 1,
  "short_run_pct": 0.7,
  "qty_exponent": null,
  "qty_tiers_enabled": false,
  "qty_tiers": [],
  "sheet_units": {},
  "sheet_w": 45,
  "sheet_h": 32,
  "sheet_margin": 0,
  "sheet_gap": 0.5,
  "min_order_qty": 0,
  "max_print_w": 0,
  "max_print_l": 0,
  "over_limit": "weld",
  "mount_cost_m2": 0,
  "mount_cost_unit": 0,
  "cap_w": 0,
  "cap_l": 0,
  "whole_board": false,
  "board_w": 0,
  "board_h": 0,
  "plan": {
    "gates": [
      {
        "kind": "quote_only",
        "note": "פרספקס — ממתין לגיליון עלויות מהלקוח"
      }
    ]
  },
  "short_run_ref_qty": 100,
  "min_order_value": 0,
  "dual_surcharge": [],
  "outsourced_margin_factor": 1.5,
  "outsourced_vat_incl": null,
  "paper_weight_pct": {},
  "size_buckets": [],
  "qty_multipliers": [],
  "curve_anchors": [],
  "tail_per_unit": null,
  "per_m2_tiers": [],
  "min_job_price": 0,
  "size_ladder": [],
  "panoramic_aspect": 0,
  "panoramic_pct": 0,
  "yield_table": [],
  "vinyl_cost_sheet": 0,
  "format_prices": [],
  "digital_setup": 0,
  "digital_per_unit": 0,
  "digital_max_qty": 0,
  "todos": [
    "פרספקס: אין עדיין עלויות ומחירים — כל מידה מוחזרת כהצעת מחיר (TODO לקוח)"
  ],
  "catalog_binds": "all",
  "sheet_price": 0,
  "outsourced_rate_m2": 0
}
```

</details>

