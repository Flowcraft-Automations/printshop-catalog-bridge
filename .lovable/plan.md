# Make total area drive suggestions between anchors

For area-priced families such as פוליגל, use total area as the primary and only size axis between anchors. Width/height shape will no longer distort a suggestion when the total area sits cleanly between known prices.

## Verified behavior and data

- The current area-family path ultimately calls the shape-aware fitted curve, which can move a result away from the two surrounding area anchors.
- The current פוליגל qty-1 anchors form a monotonic area ladder:
  - 0.160 m² → ₪55
  - 0.490 m² → ₪60
  - 0.800 m² → ₪65
  - 0.960 m² → ₪70
- Its qty-10 anchors are 0.160 m² → ₪295 and 0.960 m² → ₪470.

## Pricing change

1. Keep exact size + exact quantity anchors unchanged and returned verbatim.
2. Build the curve for the requested quantity exactly as today:
   - prefer anchors with that quantity;
   - otherwise normalize each size to the requested quantity using the fitted quantity exponent.
3. Sort that curve strictly by total area (`width × height / 10,000`).
4. Between anchors, interpolate only between the immediately smaller and larger area anchors using the existing power interpolation.
5. Below the smallest anchor, keep the smallest anchor price as the floor; above the largest, continue using the family area curve.
6. Preserve quantity scaling, monotonic cleanup, production/outsourcing floors, margin, and configured rounding.
7. Remove the aspect-ratio term from the area-family calculation and its explanation, so equal total areas at the same quantity receive the same suggestion unless one is an exact anchor.

## Scope

- Update the area-method branch in `src/lib/mdvd.ts` to use `areaCurvePrice` rather than `shapeCurvePrice` after quantity normalization and monotonic cleanup.
- Calculator and catalog continue using the shared `priceJob` entry point, so both will produce the same corrected values.
- Sheet-method family pricing remains unchanged.
- No database changes.

## Validation

- Add focused checks for פוליגל qty 1 and qty 10 covering values below, between, exactly on, and above anchors.
- Confirm suggestions never decrease as total area increases for the same quantity.
- Confirm two non-anchor dimensions with the same total area and quantity get the same suggestion.
- Confirm exact anchors still return their stored prices without rounding or curve replacement.
