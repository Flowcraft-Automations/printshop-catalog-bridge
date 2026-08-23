# Fix פוליגל suggestions: quantity must not be mixed into the size curve

## What is actually wrong

פוליגל has four anchors:

```text
40×40   qty 1   ₪55        120×80  qty 1   ₪70
40×40   qty 10  ₪295       120×80  qty 10  ₪470
```

The family uses the area method, and that branch of the engine ignores each anchor's
quantity entirely. It treats ₪295 and ₪470 (prices for ten pieces) as if they were
single-piece prices, fits one size curve through all four, and then multiplies the
result by the requested quantity again.

That is why 60×40 qty 1 suggests ₪175 (it should sit between ₪55 and ₪70) and
80×60 qty 10 suggests ₪3,095 (₪309 per piece). The two 10-unit anchors are being
counted twice — once inside the curve, once by the quantity multiplier.

## The fix

The area method becomes quantity-aware, exactly like the sheet method already is:

1. **Exact anchor wins, quantity included.** A request matching an anchor's size
   *and* quantity returns that anchor's price verbatim: 40×40 × 10 = ₪295,
   120×80 × 10 = ₪470. Today it returns 55 × 10 = ₪550.
2. **Size curve is built from anchors of the requested quantity.** For qty 1 the
   curve uses only the qty-1 anchors (₪55 → ₪70), so 60×40 lands between them
   (~₪60) instead of ₪175.
3. **Quantity curve is fitted from same-size anchor pairs.** פוליגל gives
   55 → 295 and 70 → 470 for ten pieces, i.e. roughly `qty^0.8`, not `qty^1`.
   When the requested quantity has no anchors of its own, the qty-1 curve is
   scaled by that fitted factor. With no evidence for a quantity effect the
   behaviour stays linear as today.
4. **Monotonic floor kept.** A suggestion is never below the price of an anchor
   that is smaller-or-equal in both size and quantity.
5. Validated catalog prices, the threshold/outsourcing floor, cost floor, margin
   and rounding all keep their current position in the order.

## Data note (separate from the engine)

`10 פוליגלים 50*80` is stored with qty = 1 and ₪470 — it is a ten-piece row.
Same for several `הדפסה על פוליגל 10 יחי ...` rows, which are correctly at qty 10.
The engine fix does not depend on it, but that row will distort comparisons until
its quantity is corrected. I can fix it in the same pass if you want.

## Technical notes

- `src/lib/mdvd.ts`, `priceJob` area branch (step 4): filter anchors to the
  requested quantity for the shape/size fit; add `fitAreaQtyFactor(anchors)` that
  fits an exponent from same-size / different-quantity anchor pairs (clamped 0.5–1,
  falling back to `cfg.qtyExponent`); apply `anchorFloor` as in the sheet branch;
  make the exact-anchor lookup match quantity as well.
- The breakdown line states which quantity the anchors came from and the fitted
  quantity factor.
- No schema change; `src/routes/catalog.tsx` and `calculator.tsx` pick it up
  automatically.
