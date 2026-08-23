# Configurable sheet layout and minimum order for stickers

Today the printing sheet for מדבקות is hard-coded in the code: 45×32 cm with a 0.5 cm gap, and the cost per sheet is a single number. This makes the sheet a real, per-family setting and adds a minimum order quantity.

## New settings (per family, sheet method)

In the calculator's advanced settings, a "גיליון הדפסה" group:

- גודל גיליון — רוחב × גובה ס"מ (default 45 × 32)
- שוליים לא מודפסים ס"מ — the grace border around the sheet (default 1, giving a 45×30 printable area as in the photo)
- מרווח בין מדבקות ס"מ (default 0.5)
- עלות לגיליון ₪ (₪20 for stickers) — this is the existing cost field, relabeled clearly for sheet families
- מינימום הזמנה (יחידות) — 10 for stickers

Admins edit; everyone sees the values (existing disabled-fieldset behaviour).

## How units per sheet is computed

```text
printable = (sheetW - 2×margin) × (sheetH - 2×margin)
per row    = floor((printableW + gap) / (stickerW + gap))
per column = floor((printableH + gap) / (stickerH + gap))
units      = max(rows×cols, rotated 90°)
```

Manual per-size overrides keep working exactly as today and still win over the computed number. The calculator shows the computed value with the sheet it came from, e.g. `12 יח׳ בגיליון · 45×30 שטח הדפסה · מרווח 0.5`.

## Sheet cost in the price

Unchanged in shape, now driven by the configured numbers: production cost = `ceil(units ÷ units per sheet) × עלות לגיליון`, multiplied by the profit margin, and used as the cost floor under the anchor-based price. A sticker job never prices below its sheets.

## Minimum order

Below the family minimum the calculator shows no price and a clear warning:
`מינימום הזמנה למשפחה זו: 10 יחידות`. The quantity chips/packages stay as they are; only free-typed quantities under the minimum are blocked. Existing catalog rows and suggestions are untouched by the minimum.

## Technical notes

- `src/lib/mdvd.ts`: `FamilyPricing` gains `sheetW`, `sheetH`, `sheetMargin`, `sheetGap`, `minOrderQty`, read/written from `pricing_config.v3` (`sheet_w`, `sheet_h`, `sheet_margin`, `sheet_gap`, `min_order_qty`) with the current constants as defaults. `autoUnitsPerSheet(w, h)` becomes config-aware (`autoUnitsPerSheet(cfg, w, h)`); `SHEET_W_CM`/`SHEET_H_CM`/`SHEET_GAP_CM` stay as default constants. `priceJob` returns a `belowMinOrder` flag instead of a price when `units < minOrderQty`.
- `src/routes/calculator.tsx`: new fields in the sheet-method config group, the warning state, and the units-per-sheet explanation line.
- One data update writes the מדבקות values: sheet 45×32, margin 1, gap 0.5, cost 20 ₪/sheet, minimum 10.
- No schema change — everything lives in the existing `pricing_config` JSON.
