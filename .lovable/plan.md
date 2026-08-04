# Live-fitted pricing: drop the base/rate admin table

The calculator will stop reading stored `base_price` / `rate_m2` from the family row and instead fit the line from the family's own catalog items every time you price a size. The pricing-curves table shrinks to what still needs human input: minimum charge and quantity discounts.

## What changes for you

- Choosing a family instantly derives its base price and rate from its products — no "התאם מחדש מהנתונים" button, nothing to save.
- The price breakdown stays as today (base + rate per cm² x area), plus the fit quality (number of anchors, average deviation, and the "מתאימה יותר לסולם מחירים קבוע" hint above 15%).
- The admin section at the bottom keeps only: family name, minimum charge, quantity discounts, and a read-only display of the currently fitted base/rate and fit quality.
- Families with too few priced items to fit fall back to the old flat rate-per-area behaviour, clearly labelled.

## Technical notes

- `src/lib/mdvd.ts`: `priceFromLine` takes the fit result from `fitFamilyLine(buildAnchors(products, family))` instead of `family.base_price` / `family.rate_m2`. Minimum charge, cheapest-anchor floor, quantity multipliers, exact-catalog-match (+-2% area) and round-to-5 logic all stay unchanged.
- `src/routes/calculator.tsx`: the fit is memoized per selected family and passed into pricing. `FamilyRow` loses the base/rate inputs and the refit button; base/rate render as computed read-only values. Save still writes `min_charge` and `qty_discounts`.
- Database: `families.base_price` and `families.rate_m2` are left in place (still populated by the import file) but no longer read by the calculator — no migration needed.
