# Make מקדם כמות actually control the price

## What's happening now

For area families (שמשונית and every other `method: area`), the quantity exponent you type in the family config is read, but then discarded. In `priceJob` the effective exponent is:

```text
effQtyExp = fitAreaQtyExponent(anchors) ?? qtyExponent
```

The value fitted from the anchors always wins; the field you set is used only when the anchors contain no same-size pair at two different quantities. For שמשונית such pairs exist, so the pinned number never has an effect — that's why 120×80 × 20 comes out at exactly 90 × 20 = 1,800 (label "מחיר עוגן לפי כמות"): the fitted exponent there is ~1, i.e. linear.

Two more reasons a change can look ignored:

- When the family has 2+ anchors at exactly the requested quantity, the price comes straight from the size curve at that quantity and no quantity factor is applied at all.
- The fitted exponent is clamped to 0.5–1.0, so even fitting can never express a strong quantity discount.

Sheet families (מדבקות) already honor the pinned value; only the area path is broken.

## The fix

1. **Pinned wins.** In the area branch use `cfg.qtyExponentPinned ? cfg.qtyExponent : (fitted ?? 1)`, matching the sheet branch. Typing a value in מקדם כמות overrides the fit everywhere; clearing the field returns to the fitted value.
2. **Apply it on every calculated path.** When the exponent is pinned, price the size curve at one reference quantity and scale by `(units / refQty)^e`, so the number always moves with the exponent. This never touches a verified/exact price: if the catalog has a verified item with this exact size **and** this exact quantity, that price is returned as-is, exactly as today — the exponent does not touch it. Same for an exact anchor at the same size and quantity. The exponent only affects prices that are calculated.
3. **Widen the range.** A pinned exponent is accepted in 0.2–1.0 (the fitted one keeps its own clamp) so real quantity discounts can be expressed.
4. **Show it.** The price breakdown always states which exponent was used and where it came from — `מקדם כמות 0.75 (מקובע)` vs `מקדם כמות 0.92 (מותאם מהעוגנים)` — plus the resulting multiplier, so it is obvious when the field is in effect.
5. **Floor check.** The monotone anchor floor ("never quote below a smaller-and-fewer anchor") can still hold a discounted price up. When it binds, the breakdown says so instead of silently showing an unchanged number.

## Technical notes

- `src/lib/mdvd.ts` — area branch of `priceJob`: derive `effQtyExp` from `qtyExponentPinned` first; route the `sameQty`/`areaCurvePrice` path through a reference quantity plus the quantity factor when pinned; add the "floor bound" note to `finish`.
- `src/routes/calculator.tsx` — the מקדם כמות field accepts 0.2–1.0 and the hint text distinguishes pinned from fitted.
- No schema change; `qty_exponent` already lives in `pricing_config.v3`.

## Verification

שמשונית 120×80: exponent 1 → 1,800 for 20 units (unchanged); exponent 0.8 → clearly lower; exponent 0.5 → lower still. Exact verified catalog matches and exact anchors keep returning their exact price at any exponent. מדבקות behaves exactly as today.
