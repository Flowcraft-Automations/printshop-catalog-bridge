# מדבקות — state analysis and price adjustment

## What the data shows today

Queried the 180 items in family מדבקות:

- 150 of 180 are fully closed out (נמחק / כפילות / לא רלוונטי). Only **30 items are live**.
- **0 anchors** (`is_anchor`) in this family — so the pricing curve produces nothing usable here.
- **68 items have no width/height**. Of the 30 live items, only **9** carry real sizes; the rest are "קוטר X" items with size embedded in the name only.
- Family settings: `rate_m2 = 146`, `base_price = 0`, `qty_exponent = 0.85`, **`cost_per_m2 = 0`**, `min_charge = 0`. With cost 0 and no minimum, nothing protects this family.
- **10 live items have מחיר אתר = 0** (all the "קוטר N-N" logo stickers) while סנזיי holds 115–187 ₪.
- **11 items have a סנזיי/אתר price gap.**

### Price per m² of the sized items (live)

```text
30×20   ₪60    → 1000 ₪/m²
56×17   ₪50    →  525 ₪/m²
70×20   ₪29    →  207 ₪/m²
70×50   ₪60    →  171 ₪/m²
80×60   ₪70    →  146 ₪/m²
120×80  ₪60    →   63 ₪/m²
100×100 ₪60    →   60 ₪/m²
130×130 ₪100   →   59 ₪/m²
140×140 ₪120   →   61 ₪/m²
```

## What the meeting settled

מדבקות is **two products with a hard break at 20 cm**:

- **Below 20 cm — sheet product.** Small stickers are ganged onto a slightly-larger-than-A3 sheet and plotter-cut. Direct cost per sheet ≈ ₪4 (₪3 material + ₪1 cut). Capacity example: ⌀5 cm → ~30 per sheet → ≈ ₪0.13 direct per sticker, sellable at ~₪20 per sheet's worth.
- **20 cm and up — roll product.** Produced and priced exactly like שמשונית, with a hard **₪70 minimum** for any large sticker (confirmed for 20×20 and for 100×100).
- Material waste jumps sharply above 20 cm — that is why the break sits there and not at some area threshold.

### The loss confirmed against live data

Site sells 100×100 at ₪60 and 120×80 at ₪60 against a ₪70 floor; 70×20 sits at ₪29 and 56×17 at ₪50. Every large sticker in the catalog is at or below cost. Current small prices were copied from a competitor ("פיקס") with no cost check.

### The 9×9 bundle ladder

Site ladder: 100→154, 150→163, 200→179, 250→199, 500→280, 1000→450. Sensible curve, but **all six rows store `qty = 100`**, so the bundle exponent can never reproduce it, and סנזיי holds a flat ₪154 for every one of them.

## Plan

### 1. Split the family in two

Create **מדבקות גיליון** (< 20 cm) and **מדבקות רול** (≥ 20 cm) as separate families, and reassign each live item by its size. One curve cannot serve both — one is priced per sheet slot, the other per m².

### 2. Configure מדבקות רול like שמשונית

Copy the שמשונית economics (`cost_per_m2 = 20`, outsourcing at 150×160 cm at ₪80/m², `qty_exponent = 0.85`) and set **`min_charge = 70`**. Mark anchors mirroring the שמשונית ladder so the curve matches the product it shares a press with.

Resulting reprice of the live large items:

```text
20×20    (new) → ₪70   floor
70×20    ₪29   → ₪70   floor
56×17    ₪50   → ₪70   floor (roll-printed despite the 17 cm side)
30×20    ₪60   → ₪70   floor
70×50    ₪60   → ₪75
80×60    ₪70   → ₪80
120×80   ₪60   → ₪90   (matches שמשונית 120/80)
100×100  ₪60   → ₪70–90  see open item below
130×130  ₪100  → ₪140
140×140  ₪120  → ₪150
```

Open item: Gena settled 100×100 at ₪70, but the שמשונית curve puts 120×80 — a slightly smaller area — at ₪90. Confirm whether ₪70 is the true price for 100×100 or was shorthand for "at least 70"; the rest of the ladder follows either way.

### 3. מדבקות גיליון — blocked on the units-per-sheet table

The correct model is per sheet, not per m²: `price = ceil(qty / units_per_sheet) × sheet_price`, with direct cost ₪4 per sheet. The missing input is the **units-per-sheet count per size** (3×3, 4×4, 5×5, 6×6 … 15×15) that you are to build with Gena. Only ⌀5 → ~30/sheet is known, which prices one sheet's worth at ~₪20.

Until that table exists, hold the small-sticker prices where they are rather than guessing, and set `min_charge = 20` for the sheet family so nothing sells below one sheet's worth.

### 4. Data hygiene, independent of pricing

- Fix the 10 items with **מחיר אתר = 0** — copy the סנזיי price (115–187).
- Fix the 9×9 bundle rows: set `qty` to the real bundle count (100/150/200/250/500/1000) instead of 100 everywhere, and align סנזיי to the site ladder instead of flat ₪154.
- Parse the diameter out of the "קוטר N-N" names into width/height so those ~20 items get a size and land on the right side of the 20 cm break.

## Also: the dashboard

The dashboard page exists at `/` (KPIs, migration progress, per-family breakdown) but the header nav only lists קטלוג, מחשבון מידות and משתמשים — there is no link to it, which is why you never see it.

Fix: add a "לוח בקרה" link pointing at `/` as the first nav item in `src/components/AppShell.tsx`, with `activeOptions={{ exact: true }}` so it doesn't stay highlighted on other routes.

## Technical notes

- Family split, price edits and anchor marks are data changes to `products` / `families`, applied through the catalog UI or a data migration — no pricing-logic changes required for the roll side.
- The sheet model (`ceil(qty / units_per_sheet) × sheet_price`) is **new logic** in `src/lib/mdvd.ts` plus a `units_per_sheet` mapping per size; it is out of scope until Gena's table arrives.
- Editing prices auto-sets statuses to עלה/ירד via the existing rule.
- Only code change in this round: the nav entry in `src/components/AppShell.tsx`.
