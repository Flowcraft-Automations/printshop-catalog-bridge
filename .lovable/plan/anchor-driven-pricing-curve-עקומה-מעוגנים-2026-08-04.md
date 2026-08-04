# Anchor-driven pricing curve (עקומה מעוגנים)

## The idea

Instead of fitting a line through everything in the family, the curve is built **only from sizes you personally approved**. You mark one or more items as עוגן, and every other size in that family — smaller and larger — is priced from those anchors.

Yes, this is how print/signage shops normally price: a job costs a fixed part (setup, cutting, finishing, handling) plus a per-area part (material + print). So the honest model is `price = base + rate x area`, anchored on real approved prices rather than on the messy legacy catalog.

## How the curve is derived

- **Two or more anchors** — the line is fitted through the anchors only (least squares), giving both base and rate. Everything else in the family is ignored for fitting. This is the recommended setup: one small size + one large size pins the curve well.
- **Exactly one anchor** — a single point cannot define both base and rate. The curve runs straight through the anchor with `base = 0`, i.e. price scales with area (`rate = anchor price / anchor area`). The calculator shows a note that a second anchor will make small and large sizes far more accurate, since pure per-area scaling underprices small items.
- **No anchors** — falls back to today's behaviour (fit from all family items), clearly labelled as such.
- Suggested prices stay rounded to 5 ₪ and are never below the family minimum charge.

```text
price
  |                                  . fitted from anchors
  |                          . *  <- anchor 120x80 (your price)
  |                 .  *
  |        . *  <- anchor 30x20
  |   .
  +------------------------------ area (cm²)
```

## Marking anchors

- **Catalog** — a pin/star toggle on each row (new column, plus a control in the detail drawer). Clicking it makes that item an anchor for its family; clicking again removes it. The עקומה column and the deviation column recalculate immediately for the whole family.
- **Calculator** — in the "כל הפריטים במשפחה" list, the same pin toggle per row, so you can set the anchor while looking at the curve. The chart marks anchors distinctly, and the fitted line updates live.
- Anchored items are never flagged as deviating from the curve (they define it).

## Filtering and visibility

- Column chooser gets the new עוגן column.
- Existing "רק חריגים מהעקומה" filter keeps working, now measured against the anchored curve.
- Export includes an עוגן column.

## Technical notes

- Migration: add `is_anchor boolean not null default false` to `products` (indexed on `family, is_anchor`). No other schema change; the existing history trigger will log anchor toggles automatically.
- `src/lib/mdvd.ts`: `buildAnchors` gains an anchored mode — when a family has anchored products, they become the anchor set verbatim (no anomaly dropping, since you chose them). `fitFamilyLine` handles the single-anchor case by forcing `base = 0`. A `fitSource` field (`anchors` | `single-anchor` | `all-items`) is returned so the UI can label where the curve came from.
- `src/routes/catalog.tsx`: `curveByProduct` uses the anchored fit; new pin column and toggle mutation.
- `src/routes/calculator.tsx` and `src/components/CurveChart.tsx`: pin toggle in the family item list, anchor styling in the chart, and a source label above the base/rate fields.
