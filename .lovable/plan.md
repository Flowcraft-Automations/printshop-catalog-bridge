# Why 120×100 quotes ₪80 while 100×100 quotes ₪95

## What the data actually says

The calculator is not miscalculating — it is reading a contradictory catalog. For שמשונית, size 120×100, quantity 1, there are **three verified rows at once**:

| Row name | Price used |
|---|---|
| הדפסה על שמשונית 120/100 ס"מ | ₪105 |
| שמשונית 120/100 — עוגן מאושר (anchor) | ₪105 |
| הדפסה על שמשונית 120/100 | ₪80 |

100×100 has only one verified row (₪95). So:
- 100×100 → ₪95 (the single verified price)
- 120×100 → ₪80, because the exact-match lookup takes the **first** verified row it finds for that size and quantity, and the ₪80 duplicate happens to come first
- 130×100 → ₪111 (no exact row, so the curve interpolates — and this value is the sane one)

The ₪80 row also carries no website price and looks like a leftover short-named duplicate of the ₪105 row.

## The fix, in two parts

### 1. Clean the conflicting data (immediate)
Mark the duplicate ₪80 שמשונית 120/100 row as not verified (keeping it in the catalog with its history), so only the ₪105 pair remains authoritative. Then 100×100 → ₪95 and 120×100 → ₪105 line up.

Also sweep the whole catalog for the same disease: any group of verified rows sharing family + width + height + quantity whose prices disagree. These are listed for review rather than auto-changed, because only you can say which price is correct.

### 2. Make the engine refuse to guess (prevents recurrence)
- When several verified rows match the requested size and quantity with **different** prices, stop picking the first one. Prefer the manually approved anchor row; if there is no anchor, use the highest price and show a warning line: "מחירים מאומתים סותרים לאותה מידה" with the conflicting values.
- Add a **monotonic sanity check** on the verified exact-match path: if the verified price for a size is lower than the verified price of a strictly smaller size at the same quantity, flag it in the calculator result instead of quoting it silently. That is exactly the signal that would have caught this before it reached a customer.
- Surface a catalog-side indicator: a filter "כפילויות מידה סותרות" that lists verified rows in conflict, so cleanup is a normal workflow instead of a bug hunt.

## Technical notes

- Root cause is in `src/lib/mdvd.ts`, path **P0** (`validated.find((a) => sameSize(...) && a.qty === units)`), which resolves against `familyValidated()` output sorted only by area then quantity — ties are order-dependent.
- Change P0 to collect **all** matches, then resolve by: anchor row first, else max price, and return a `conflicts` payload the calculator renders as a warning.
- The smaller-size regression check reuses the existing verified anchor list for the family at the same quantity; it produces a warning only, never a price change.
- Data cleanup runs as a data update on `products` (`verified = false` on the duplicate row); the change is recorded by the existing history trigger and is revertible.
