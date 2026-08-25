# Why מדבקות says "לא ניתן לייצור" — and how to fix it

## What's actually happening

A 22×14 sticker is rejected with `מעל האורך המרבי 20 ס"מ — לא ניתן לייצור`.

The cause is a config collision, not the sticker size. When the two size-limit blocks were merged into one "גבול הדפסה", the sheet-family outsourcing threshold (20×20 for מדבקות — the size above which stickers go to an external supplier at 70 ₪/m²) became the **machine print limit** as well. The calculator now reads:

- גבול הדפסה — רוחב 150, אורך **20**
- התנהגות מעל הגבול: ריתוך (weld)

and the weld branch blocks anything longer than the length limit outright. So every sticker over 20 cm long is declared unproducible instead of being priced as outsourced.

The stored family record still has `max_print_l = 0` (no length limit); the 20 is coming from the form falling back to the outsourcing threshold.

## The fix

Separate the two concepts again, because for sheet families they are genuinely different numbers:

1. **סף מיקור חוץ (רוחב × גובה)** — a sheet-family field, 20×20 for מדבקות. Above it, pricing switches to the outsourcing branch (70 ₪/m², 1 m² minimum) exactly as before.
2. **גבול הדפסה / גבול ייצור מוחלט** — machine capability only. For מדבקות: width 150, no length limit. Empty means no limit.

Behaviour changes:

- The form no longer falls back to the outsourcing threshold when the print limit is empty; an empty print limit means unlimited.
- `weld` never applies to sheet families — a stack of stickers is not a welded panel. Sheet families over their print limit are simply outsourced, and only the absolute production cap can block them.

With that, 22×14 at qty 22 prices through the outsourcing branch: 0.031 m² × 22 = 0.68 m² → 1 m² minimum → 70 × 1.3 = 91 → ₪91.

## Technical notes

- `src/routes/calculator.tsx` — drop the `saved.thresholdW/thresholdH` fallback on lines 215–216; restore the two threshold inputs for sheet families and keep the machine block reading only `maxPrintW/maxPrintL`; `cfg.thresholdW/H` come from the threshold fields again, not from `maxPrintW/L`.
- `src/lib/mdvd.ts` — in `machineCheck`, treat `overLimit === "weld"` as non-blocking for `method === "sheet"` (fall through to the normal above-threshold pricing path); keep the absolute `capW/capL` block unchanged.
- Data: for מדבקות keep `outsource_width_cm/height_cm = 20/20`, set `max_print_w = 150`, `max_print_l = 0`. No schema change.
