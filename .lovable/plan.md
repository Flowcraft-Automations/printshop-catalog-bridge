# מדבקות — state analysis and price adjustment

## What the data shows today

Queried the 180 items in family מדבקות:

- 150 of 180 are fully closed out (נמחק / כפילות / לא רלוונטי). Only **30 items are live**.
- **0 anchors** (`is_anchor`) in this family — so the pricing curve produces nothing usable here.
- **68 items have no width/height**. Of the 30 live items, only **9** carry real sizes; the rest are "קוטר X" items with size embedded in the name only.
- Family settings: `rate_m2 = 146`, `base_price = 0`, `qty_exponent = 0.85`, **`cost_per_m2 = 0`**, no outsourcing rate. With cost 0, no cost floor protects this family at all.
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

The small end is priced sanely; the large end collapses to a flat ~60 ₪/m² and is close to flat in absolute money (120×80 and 100×100 both ₪60, 140×140 only ₪120 for 3× the area). Large stickers are the loss-makers.

### The 9×9 bundle ladder

Site ladder: 100→154, 150→163, 200→179, 250→199, 500→280, 1000→450. Sensible curve, but **all six rows store `qty = 100`**, so the bundle exponent can never reproduce it, and סנזיי holds a flat ₪154 for every one of them.

## Suggested price adjustments

1. **Set anchors** for מדבקות so the curve works (mark `is_anchor`):
   - 30×20 → ₪60 (keep, matches market)
   - 70×50 → ₪95
   - 100×100 → ₪150
   - 140×140 → ₪260
   This yields a power curve of roughly `price ≈ 300 × area^0.5`, i.e. ~₪930/m² at 0.06 m² down to ~₪133/m² at 2 m² — sub-linear but no longer collapsing.

2. **Reprice the large sizes** (the main leak):

```text
120×80   ₪60  → ₪165
100×100  ₪60  → ₪150
130×130  ₪100 → ₪230
140×140  ₪120 → ₪260
80×60    ₪70  → ₪105
70×20    ₪29  → ₪60   (below any sane minimum today)
56×17    ₪50  → ₪60
```

3. **Introduce a minimum charge of ₪60** for the family (`min_charge`) — nothing in מדבקות should leave the shop under that.

4. **Fix the 10 items with מחיר אתר = 0** — copy the סנזיי price (115–187) to the site so the website stops showing free products.

5. **Fix the 9×9 bundle rows**: set `qty` to the real bundle count (100/150/200/250/500/1000) instead of 100 everywhere, and align סנזיי to the site ladder instead of flat ₪154. With correct qty the exponent 0.85 reproduces the ladder closely.

6. **Close the size gap**: parse the diameter out of the "קוטר N-N" names into width/height so those 20 items join the curve instead of floating free.

### Needs your input

`cost_per_m2` for מדבקות is 0, so I cannot verify any of the above against real production cost. Give me Genadi's material + print cost per m² for sticker vinyl and I will re-derive the floor and adjust the numbers where the curve dips under it.

## Also: the dashboard

The dashboard page exists at `/` (KPIs, migration progress, per-family breakdown) but the header nav only lists קטלוג, מחשבון מידות and משתמשים — there is no link to it, which is why you never see it.

Fix: add a "לוח בקרה" link pointing at `/` as the first nav item in `src/components/AppShell.tsx`, with `activeOptions={{ exact: true }}` so it doesn't stay highlighted on other routes.

## Technical notes

- Price/anchor changes above are data edits (`products`, `families` rows), applied through the catalog UI or a migration — no pricing-logic changes needed.
- Editing prices will auto-set the statuses to עלה/ירד via the existing rule.
- Only code change in this plan: the nav entry in `src/components/AppShell.tsx`.
