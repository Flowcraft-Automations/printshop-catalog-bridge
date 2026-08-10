# Adding the ₪200k monthly spend to the pricing

## The idea in plain words

Today the calculator only knows sizes and prices from the catalog. It has no idea whether those prices actually cover what the business costs to run.

You spend ₪200,000 every month and currently invoice ₪175,000. So every shekel you invoice has to carry a piece of that ₪200k — and right now it can't: ₪175k of income against ₪200k of cost means each shekel invoiced actually costs you ₪1.14. Today's prices are, on average, about 14% below break-even, and about 43% below a price that would leave a 20% profit.

So the app needs two numbers from you:

1. **הוצאה חודשית** — ₪200,000 (editable)
2. **מחזור חודשי** — ₪175,000 today (editable — you can also type a target figure to see what prices would need to look like)

From those two it computes one simple thing: **how much of each price is already spoken for**, and whether the price the curve gives you actually leaves anything behind.

## What you will see in the calculator

Under the calculated price, a small panel (with today's 200k / 175k):

```text
מחיר לפי עקומה              ₪120
עלות בפועל (114%)           ₪137
נשאר                        ₪17-   (הפסד)
```

When the leftover is negative or below your target the panel turns red.


Plus a target-profit field ("רווח מטרה", default 20%). Below the target, the panel shows the price that would hit it — with today's numbers that is roughly ×1.43 on every price:

```text
מתחת לרווח המטרה — מחיר מומלץ ₪170
```


The curve price itself does not change. Nothing gets silently inflated — you just see whether the number is healthy, and you can adopt the recommended price with one click.

## In the catalog

The **מחיר לפי עקומה** column gets the same treatment: a small marker on rows whose suggested price falls below the target profit, and an optional filter **רק מתחת לרווח מטרה** so you can sweep the catalog for underpriced items. Suggested numbers stay as they are; the marker is informational.

## Where the settings live

A small "כלכלת העסק" panel in the calculator sidebar with three fields — monthly spend, expected monthly revenue, target profit % — saved in the database so both pages read the same values, and editable at any time.

## Technical notes

- Migration: new single-row table `business_config` (`monthly_cost`, `expected_monthly_revenue`, `target_margin_pct`) with grants and permissive RLS, matching the existing `families` / `app_config` pattern. Seeded with 200000 / 250000 / 20.
- `src/lib/mdvd.ts`: pure helper `marginBreakdown(price, cfg)` → `{ overheadShare, overheadAmount, leftover, leftoverPct, meetsTarget, recommendedPrice }`, where `overheadShare = monthly_cost / expected_monthly_revenue` and `recommendedPrice = round5(overheadAmountPerJob / (1 - targetMargin))`.
- `src/routes/calculator.tsx`: config panel + margin panel under the result, plus an "אמץ מחיר מומלץ" action reusing the existing create-product flow.
- `src/routes/catalog.tsx`: reuse `marginBreakdown` on the existing `curveByProduct` suggestions for the marker and the new filter toggle.
- No change to the power-curve model, anchors, quantity exponent, minimum charge or rounding.
