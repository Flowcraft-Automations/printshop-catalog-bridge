# Make family pricing settings simple

You're right — the tier editor exposes every engine parameter at once. The engine stays exactly as it is (it works, and it's what makes every family configurable). What changes is what a non-technical person sees.

## The idea: two modes

**Simple mode (default, what everyone sees)**
Per family, one short card with plain-Hebrew questions only:

1. איך מתמחרים? — three big buttons with a one-line explanation each:
   - לפי גודל (מחיר לפי שטח) — "כל מטר רבוע עולה X ₪"
   - לפי גיליון (מוצרים קטנים) — "כמה יוצאים מגיליון אחד"
   - כמו משפחה אחרת — "השתמש בתמחור של שמשונית"
2. מחיר מינימום להזמנה — one number.
3. הנחת כמות — a tiny table: כמות / מחיר ליחידה, with plain rows (10 → 0.85). Only that.
4. עיגול מחיר — dropdown: ללא / 5 ₪ / 10 ₪.

Everything else (מקדם תקורה, מרווח ס"מ, חשיפת גדלים, נירמול צדדים, per-running-meter, power model) gets sensible defaults and disappears from the screen.

**Advanced mode** — a "הגדרות מתקדמות" toggle at the top of the card reveals today's full editor unchanged, for you/admin only.

## Size bands, explained like a human

Instead of "שכבות" with 4 dimension fields (צד ארוך מ/עד, צד קצר מ/עד), the simple mode shows one sentence per band:

```
מדבקות עד 20 ס"מ    →  לפי גיליון
מדבקות מ-20 ס"מ     →  כמו שמשונית, מינימום 70 ₪
```

Adding a band = pressing "הוסף טווח גודל" and typing one number (the cut-off in cm). The engine's 4 dimension fields are filled automatically from that single number.

## Live answer instead of parameters

At the bottom of the simple card, a permanent mini-calculator: מידה + כמות → the price and one sentence of "why" ("לפי גיליון: 30 יחידות בגיליון, 4 גיליונות"). That's how a non-technical user validates a change without understanding the config.

## Nothing else changes

Same `pricing_config` JSON, same `priceJob` engine, same calculator, catalog warnings and quantity ladder. Simple mode is just a friendlier writer for the same config, so all current families keep working and existing verified prices stay identical.

## Technical notes

- New `src/components/pricing/SimpleFamilyPricing.tsx` reading/writing the same `families.pricing_config`.
- Existing `TierEditor.tsx` stays untouched, rendered only behind the advanced toggle.
- Mapping layer: single cut-off cm ⇄ `min_long/max_long/min_short/max_short`; hidden fields keep their current values on save (no data loss round-trip).
- If a family's config can't be represented simply (unusual combination), the card shows a note and opens advanced mode automatically.
