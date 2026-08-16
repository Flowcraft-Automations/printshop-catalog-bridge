# Size tiers for every family

## What we're building, in plain English

Today a family has one set of numbers: one cost per m², one minimum price, one quantity discount, plus a single "above this size we outsource" rule. That is too simple. A sticker under 20 cm and a sticker over 20 cm are two different products made on two different machines at two different costs.

So each family gets **size tiers**: a list of size bands, and each band carries its own cost, its own minimum price, its own quantity curve, and its own price anchors. The calculator looks at the size you typed, picks the matching band, and prices from that band. The old outsourcing rule becomes just the top band of שמשונית — nothing special anymore.

## How a tier is defined

Each tier says when it applies and how it prices:

```text
label:        name shown in the calculator
applies:      up to N cm / from N cm / from N m²
cost mode:    per m²    -> cost per m²
              per sheet -> sheet cost + units per sheet
min charge:   the floor price inside this band
qty exponent: bundle discount curve inside this band
```

Anchors already live on products, so each anchor automatically belongs to the band its size falls into. Each band fits its own curve, so a small sticker can no longer drag a large one down.

## The two families we can configure now

שמשונית, exactly today's numbers rewritten as tiers:

```text
1. up to 150x160 cm   per m2 20    min 25    qty exp 0.85
2. from 150x160 cm    per m2 80    min 25    qty exp 0.85
```

מדבקות, the split the meeting settled:

```text
1. under 20 cm   per sheet: 4 per sheet, units per sheet from Gena's table   min 20
2. from 20 cm    per m2 20 (same press as שמשונית)                            min 70
```

Band 2 immediately flags the large stickers being sold below cost: 100x100 at 60, 120x80 at 60, 70x20 at 29, 56x17 at 50 — all under the 70 floor.

Band 1 stays configured but incomplete. The units-per-sheet count per size (3x3, 4x4, 5x5 up to 15x15) is the table you're building with Gena; only 5 cm diameter at about 30 per sheet is known. Until it arrives, small sticker prices stay untouched and only the 20 minimum applies.

## What changes on screen

- Calculator: a line under the size inputs naming the band the size landed in and why, with that band's cost floor and minimum. The admin panel edits the list of bands instead of the single outsourcing block.
- Catalog: the cost floor column uses each item's own band, so the below-floor warning is finally right for large stickers.
- Curve chart: a marker at each band boundary, and one fitted curve per band.
- Header: a "לוח בקרה" link is added so the dashboard page is reachable — it exists at `/` but nothing links to it.

## Technical notes

- Add a `tiers` jsonb column to `families`, and seed it from the existing cost, minimum and outsourcing fields so behaviour is identical on day one. The old columns stay in place until the UI is fully moved over.
- `src/lib/mdvd.ts`: `jobCost()` gains a tier lookup and a per-sheet cost mode; `buildAnchors()` and `fitPowerCurve()` group anchors per tier.
- `src/routes/calculator.tsx`, `src/routes/catalog.tsx` and `src/components/CurveChart.tsx` read tier values instead of the flat family fields.
- `src/components/AppShell.tsx`: add the dashboard nav link.
- Sticker data cleanup — assigning items to the correct side of the 20 cm break, fixing the 10 items priced 0 on the website, and fixing the 9x9 bundle rows that all store qty 100 — is a separate pass once the tiers exist.
