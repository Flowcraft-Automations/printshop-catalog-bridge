# Fix פוליגל suggested prices: rounding and conflicting anchors

## What is actually wrong (verified)

In the screenshot almost every row is an anchor, so it shows its own stored price
verbatim. The stored qty-1 anchors themselves disagree:

```text
0.32 m²  40/80   ₪60
0.40 m²  50/80   ₪64
0.48 m²  60/80   ₪62      <- cheaper than a smaller anchor
0.48 m²  120/40  ₪65      <- same area, different price
0.49 m²  70/70   ₪60      <- bigger, cheapest of the three
```

The only real engine output in view is 60/60 (0.36 m², not an anchor).
Interpolating ₪60 → ₪64 gives ≈₪62, but פוליגל's rounding is step 5 **always
rounded up**, so it becomes ₪65 — above the ₪64 of a larger item.

Two causes: round-up on a family whose entire price range is ₪55–₪70, and
contradictory anchors.

## Change 1 — rounding to nearest, step 1

- Rounding becomes **round to nearest** everywhere instead of always up.
- Default step becomes **1 ₪** for all families; families that already have a
  larger step keep it as a per-family setting, and the step field stays editable
  in the family pricing screen.
- The cost floor and outsourcing floor keep their current position in the order:
  the floor is applied before rounding, so a rounded-down result can never drop
  below the production cost.

With this, 60/60 suggests ₪62 and sits cleanly between its neighbours.

## Change 2 — conflicting anchors are averaged and flagged

- Anchors of the same quantity whose areas are within ±2% of each other are
  merged into one curve point at their **average price** (0.48 m²: 62 and 65 → 63.5).
- After merging, the anchor ladder is still checked for monotonicity. An anchor
  priced below a smaller-or-equal anchor (70/70 at ₪60) is kept in the data but
  marked inconsistent, and the curve treats the group as an average as well, so
  the ladder stays rising.
- Exact anchor matches (same size + same quantity) still return their own stored
  price verbatim and unrounded — the averaging only affects prices *between*
  anchors.
- A warning appears where anchors are managed:
  - family pricing screen: a list "עוגנים סותרים" naming each conflicting pair
    with their sizes and prices;
  - catalog: the anchor cell of a conflicting row gets an amber marker with a
    tooltip naming the anchor it conflicts with.

## What you will see in פוליגל

```text
60/60  0.36 m²  → ₪62   (was ₪65)
suggestions rise smoothly with שטח מ״ר instead of jumping over larger anchors
70/70, 60/80, 120/40 flagged as conflicting so you can decide the real price
```

## Technical notes

- `src/lib/mdvd.ts`: `roundUpTo` becomes `roundTo(value, step, direction)` with
  `nearest` as the default; `parseConfig` defaults `rounding` to 1 instead of 5.
  In the anchor builder, group anchors by quantity and ±2% area, emit one curve
  point per group with the mean price, and return the conflicts list alongside
  the anchors so the UI can render them.
- `src/routes/calculator.tsx`: family config card renders the conflicts list and
  the rounding step/direction fields.
- `src/routes/catalog.tsx`: anchor cell marker + tooltip from the same conflicts
  data; the "לפי עקומה" and "סטייה מהעקומה" columns recompute automatically.
- No schema change. Existing `rounding: 5` values in `pricing_config` are left
  untouched unless you edit them; only the default for families without an
  explicit value changes.
