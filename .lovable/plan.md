# Suggested prices must keep growing with size

## What is happening

מדבקות is configured with an outsourcing threshold of 20×20 cm and a 1 m² billing
minimum. Any sticker where **both** sides exceed 20×20 leaves the anchor curve entirely
and is priced as:

```text
70 ₪/m² × max(1 m², area) × margin 1.3 → 91 → rounded 95
```

That is why 70×50 (0.35 m²), 80×60 (0.48), 120×80 (0.96) and 100×100 (1.00) all suggest
₪95, while your own anchors say 70×50 = ₪100 and 80×60 = ₪105. Only past 1 m² does the
number move again (130×130 → ₪155, 140×140 → ₪180). The anchors above the threshold are
simply ignored today.

## The fix: anchors win above the threshold too

Above the threshold the engine will price exactly like below it — from the family's own
anchors (size curve, and quantity curve for sheet families) — and the outsourcing cost
becomes a **floor**, not the price:

```text
suggested = max( anchor_curve_price , outsource_cost_per_m2 × area × units × margin )
```

Notes on this:

- The 1 m² billing minimum stops inflating small jobs into a flat ₪95. It stays only as
  the outsourcing floor's own minimum charge, so a tiny outsourced job is never billed at
  a few shekels — but it can no longer override a higher/lower anchor-based curve for
  sizes that have anchors nearby.
- An exact anchor (same size + same quantity) still returns its own price verbatim,
  above the threshold as well — so 70×50 = ₪100 and 80×60 = ₪105 instead of ₪95.
- With the מדבקות qty-1 anchors (70×50 = 100, 80×60 = 105, 130×130 = 155, 140×140 = 180)
  the curve rises continuously, so 100×100 lands between ₪105 and ₪155 instead of ₪95,
  and 120×80 sits just under it.
- The monotonic guard stays: a suggestion is never below the price of an anchor that is
  smaller-or-equal in both size and quantity.
- The threshold rule itself is unchanged — outsourcing is flagged only when both sides
  exceed the threshold sides, as agreed.

## What you will see

- Calculator breakdown states the source: "עקומת עוגנים" with the anchors used, plus a
  line "מעל הסף — רצפת מיקור חוץ ₪X" when the floor is what set the price.
- Catalog "לפי עקומה" and "סטייה מהעקומה" grow smoothly with שטח מ״ר across the family,
  no more repeated ₪95 blocks.
- The מיקור חוץ tag on above-threshold rows stays, since it still describes production.

## Technical notes

- `src/lib/mdvd.ts` — `priceJob`: remove the early return of branch 2 (above-threshold).
  Instead compute `outsourceFloor = cfg.outsourceCost > 0 ? cfg.outsourceCost × max(area,
  minUnitArea/units) × units × margin : 0`, fall through to the normal sheet/area anchor
  branches, and apply `Math.max(curvePrice, outsourceFloor)` inside `finish`. Keep the
  existing `noOutsourceCost` flag for families with no configured outsourcing cost, and
  keep `cost`/`costFloorValue` computed as today so the cost columns are unaffected.
- `src/routes/calculator.tsx` — show the new source/floor wording in the breakdown card.
- No schema or data changes; `src/routes/catalog.tsx` uses the same engine and updates
  automatically.
