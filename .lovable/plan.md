# Machine limits, material costs and the kapa mounting step

Three separate things from your notes, mapped onto what the calculator already has.

## 1. Material cost per m² — data only, no new fields

The existing fields already carry this:

- עלות ייצור ₪/מ״ר (מתחת לסף) = raw material
- עלות מיקור חוץ ₪/מ״ר (מעל הסף) = outside printing

So this is a data update per family:

```text
מדבקת ויניל     6 ₪/מ״ר
פוליגל          6 ₪/מ״ר
שמשונית         6 ₪/מ״ר
קנבס           15 ₪/מ״ר
קאפה           46 ₪/מ״ר  (40 board + 6 vinyl)
```

The breakdown line will say the number is raw material only (no ink, labor or overhead), so nobody reads it as a full cost.

## 2. Machine limits — a printable-width gate per family

New per-family settings in advanced config (sheet + area methods):

- רוחב הדפסה מרבי (ס״מ) — 150 for roll materials, 60 for kapa direct print
- אורך מרבי (ס״מ) — empty = unlimited, 200 for canvas
- מעל הרוחב: ריתוך פאנלים / לא ניתן לייצור

When one side exceeds the printable width:

- weldable families (שמשונית, פוליגל, ויניל): the item is flagged
  "ריתוך פאנלים — N פאנלים", the panel count is `ceil(side ÷ max width)`, and the
  existing outsourcing/threshold path continues to drive the price exactly as today.
  No new price term unless you later want a per-seam cost.
- non-weldable families (קנבס beyond 200 cm): no price, a clear warning
  "לא ניתן לייצור — מעל רוחב/אורך מרבי", same behaviour as the minimum-order block.

זכוכית stays as fixed panels: max width/length left empty, nothing changes.

## 3. Kapa: mounted vinyl above 60×90

New settings for the family:

- גבול הדפסה ישירה (ס״מ) — 60 × 90
- עלות הדבקה ₪/מ״ר and/or עלות הדבקה ליחידה ₪

Above that boundary the item is a printed vinyl sticker mounted on board — a different
product with an extra step. The calculator will:

- label it "הדפסה ישירה" or "הדבקת ויניל על קאפה" in the breakdown;
- add the mounting cost into the production cost, so the cost floor jumps at the
  boundary instead of the ladder rising smoothly through it;
- leave anchors in charge of the customer price as usual, with the floor applied on top.

## Technical notes

- `src/lib/mdvd.ts`: `FamilyPricing` gains `maxPrintW`, `maxPrintL`, `weldable`,
  `mountW`, `mountH`, `mountCostM2`, `mountCostUnit`, read/written from
  `pricing_config.v3` (`max_print_w`, `max_print_l`, `weldable`, `mount_w`, `mount_h`,
  `mount_cost_m2`, `mount_cost_unit`). `JobPrice` gains `panels`, `overMachine`
  (blocking, like `belowMinOrder`) and `mounted` + the mounting cost inside `jobCost`.
- `src/routes/calculator.tsx`: new "מגבלות מכונה" group in advanced settings, the
  panel/mounting labels in the breakdown, and the blocking warning for non-weldable
  oversize.
- One data update writes the material costs and the machine limits per family.
- No schema change — everything lives in the existing `pricing_config` JSON.
