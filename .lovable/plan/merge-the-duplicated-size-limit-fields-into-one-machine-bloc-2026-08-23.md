# Merge the duplicated size-limit fields into one machine block

The advanced settings now show three different pairs of size fields that all mean
"how big can this product be": `סף רוחב / סף גובה` (the outsourcing gate, 150×160 for
קאפה), `רוחב הדפסה מרבי / אורך מרבי`, and `גבול הדפסה ישירה — רוחב / גובה` (60×90).
The last two describe the same physical boundary and only differ in what happens above
it, so they collapse into one.

## New layout of the settings

Row 1 — pricing method and the outsourcing gate (unchanged fields, clearer heading):

- שיטת תמחור
- סף מיקור חוץ — רוחב / גובה (today's `סף רוחב` / `סף גובה`)

Row 2 — costs, margin, rounding/packages, short run, minimum order (unchanged).

New block at the end, `מגבלות מכונה`:

- גבול הדפסה — רוחב (ס"מ) × אורך (ס"מ)
- מעל הגבול: a selector with three behaviours
  - ריתוך פאנלים — split into panels (banners, poligal, vinyl)
  - הדבקת ויניל על הלוח — the kapa mounting step, enables the two cost fields
  - לא ניתן לייצור — blocked (canvas over 150×200)
- עלות הדבקה ₪ למ״ר and ₪ ליחידה — shown only for the mounting behaviour

The sheet block (גיליון הדפסה) stays where it is, after the machine block, so the
pricing fields are no longer split in the middle by another group.

## Data behind it

`maxPrintW` / `maxPrintL` stay as the single boundary. `weldable` and the separate
`mountW` / `mountH` are replaced by one `overLimit` value: `weld` | `mount` | `block`.
Existing family values map over:

- שמשונית, פוליגל, מדבקות: 150 wide, `weld`
- קנבס: 150×200, `block`
- קאפה: boundary becomes 60×90 with `mount` (its current `mount_w`/`mount_h`)

The pricing engine keeps the same behaviour — panels, mounting cost, and the block
warning — it just reads the boundary and the behaviour from one place instead of two.

## Technical notes

- `src/lib/mdvd.ts`: `FamilyPricing` drops `weldable`, `mountW`, `mountH`; adds
  `overLimit`. `machineCheck` uses `maxPrintW`/`maxPrintL` for all three behaviours and
  keeps returning `panels`, `mounted`, `blocked`, `note`. Reader keeps backward
  compatibility with the current `weldable`/`mount_w`/`mount_h` keys.
- `src/routes/calculator.tsx`: `Draft` and the config memo follow the same change; the
  machine block moves below the sheet-independent fields.
- One data update rewrites the four families' configs into the new shape.
