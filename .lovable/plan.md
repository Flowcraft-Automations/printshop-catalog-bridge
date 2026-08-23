# Why 85×120 costs less than 120×80 — and the fix

## Verified cause

שמשונית has two anchors for the exact same size 120×80, qty 1:

```text
120/80  "הדפס‍ה על שמשונית 120/80 ס"מ"   ₪90   verified
120/80  "הדפסה על שמשונית 120/80"          ₪70   not verified
```

Both are flagged as anchors. The engine merges anchors with the same quantity and
near-identical area into one curve point at their **average**, so 0.96 m² enters the
curve at ₪80 instead of ₪90. The next anchor up is 200×100 = 2.0 m² at ₪150.

- 120×80 is an exact anchor match, so the catalog shows its own stored ₪90.
- 85×120 = 1.02 m² is not an anchor, so it interpolates from the merged ₪80 point
  toward ₪150 and lands at ₪84 — below the ₪90 of a smaller item.

So the curve is behaving as designed; the input data has two contradicting anchors
and the averaging hides the conflict instead of resolving it.

## Fix

1. **Verified anchors win a conflict.** When several anchors share the same quantity
   and area (±2%), use the verified ones only; average only when they are all equally
   verified (all verified or all unverified). Here 0.96 m² becomes ₪90.
2. **Monotonic floor now bites.** With 0.96 m² at ₪90, 1.02 m² interpolates to ≈₪95,
   and the existing "never below a smaller-or-equal anchor" guard keeps it there.
3. **Conflict stays visible.** The pair keeps appearing in "עוגנים סותרים" on the
   family pricing screen and as the amber anchor marker in the catalog, with the
   tooltip stating which price was used and which was ignored.

Nothing else changes: exact anchor matches still return their own stored price,
quantity handling, thresholds/outsourcing, cost floor, margin and rounding are untouched.

## Optional data cleanup

The unverified ₪70 row looks like a stale duplicate of the ₪90 one. Say the word and
I will clear its anchor flag (the product itself stays) so the conflict disappears
entirely rather than just being resolved by rule.

## Technical notes

- `src/lib/mdvd.ts`, `mergeCloseAnchors`: within each same-qty / ±2%-area group, if the
  group contains verified anchors, drop the unverified ones before averaging; keep the
  full group in the returned `conflicts` list so the UI can still flag it. Requires the
  anchor builder to carry `verified` through from the product row.
- `src/routes/calculator.tsx` and `src/routes/catalog.tsx` only get the extended tooltip
  text; no schema change.
