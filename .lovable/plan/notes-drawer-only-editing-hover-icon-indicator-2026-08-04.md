# Notes: drawer-only editing + hover icon indicator

Replace the inline note editing with a Zoho-style approach: notes are written in the item's detail panel, and rows only show a small note icon with a tooltip preview.

## Catalog
- Remove the inline editable note field from the table (drop the `NoteCell` component usage).
- Replace the "הערות" column with a narrow icon column: when an item has a note, show a small note icon; hovering it shows a tooltip with the note text (truncated to a few lines). No icon when the note is empty.
- Keep the column sortable/filterable and toggleable in the column chooser, and keep notes in the Excel/CSV export.
- The detail drawer keeps the multi-line "הערות" textarea as the single place to write notes.

## Migration board
- Remove the inline note input from each row; show the same note icon + tooltip.
- Clicking the icon (or the row) opens the item so the note can be edited in the detail panel.

## Technical notes
- Files: `src/routes/catalog.tsx`, `src/routes/migration.tsx`.
- Tooltip via the existing shadcn tooltip primitive, styled to match the app's navy/cream theme; ensure RTL placement is correct.
- No schema or query changes; notes still save through the existing product update mutation and are logged in `product_history`.
