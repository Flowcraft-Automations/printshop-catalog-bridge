# Final price should include production cost

Today the big number at the top is the curve price only. In your screenshot it shows 210₪ even though the job's cost floor is 410₪ (3.42 m² outsourced print at 80₪/m² = 274₪ direct × 1.5). Raising it to the real price requires clicking "השתמש ב410₪" in the panel below — easy to miss.

## What changes

- The headline price becomes the **final price**: the higher of the curve price and the cost floor. For the screenshot case it shows 410₪ instead of 210₪.
- When the floor is what's driving it, a small marker under the number reads "לפי עלות ייצור" and shows the curve price struck through next to it, so you can still see what the curve said.
- The per-unit figure is derived from the same final price, and "צור מוצר" carries that final price (already the case, now consistent with what you see).
- The per-unit number is formatted properly (210.00₪ instead of the current 210.000 with no currency sign).

## Cost panel below

- The red "מחיר העקומה מתחת לרצפת המחיר" block stays as the explanation, but the button flips meaning: instead of "השתמש ב410₪" it becomes an override to **keep the curve price** ("השתמש במחיר העקומה 210₪"), since the floor is now applied by default.
- The gross-profit line always uses the final price, so it never shows a negative margin unless you deliberately override.

## Technical notes

- `src/routes/calculator.tsx`: `effectivePrice` becomes `Math.max(calc.total, floorPrice)` when `cost.hasCost`, with the existing `useFloorPrice` state inverted into `overrideCurve` (defaults off, resets on family/size/qty change). The sticky bar renders the final total and `final/nq` for the unit.
- No change to `src/lib/mdvd.ts`, no schema change — `jobCost` / `costFloor` already produce the floor.
