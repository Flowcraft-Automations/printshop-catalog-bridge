# Hide unauthorized families from non-admin users

Regular users are correctly blocked from seeing rows of families they aren't assigned, but the family lists themselves (dropdowns, pickers, and derived category lists) are still built from the full families/products data, so restricted family names remain visible.

## What changes

1. **Catalog family picker** — the "כל המשפחות" checkbox list is built from the full families table. It will be built from the allowed list only, so a restricted user sees only their families.
2. **Catalog group/category filters** — the "קבוצה בסנזיי" and "קטגוריה באתר" option lists are derived from all products. They will be derived from the permission-filtered products only.
3. **Edit drawer family select** — the family dropdown inside the item drawer lists all families; it will list only allowed ones for non-admins.
4. **Category map page** (`/categories`) — currently aggregates every product. It will aggregate only allowed-family products for non-admins.
5. **Sanity pass** — confirm the calculator's category picker and reference lists already respect the allowed list (they do) and that no other screen leaks family names.

## Technical notes

- Single source of truth: a memoized `allowedFamilySet` derived from `useAuth().allowedFamilies` (null = admin, no restriction).
- Apply it at the point where option lists are computed, not only where rows are filtered.
- No schema, RLS, or pricing-logic changes; this is display filtering on top of the existing permission model. (Note: row-level enforcement on the server still relies on the existing RLS policies — this change is about the UI no longer revealing names.)
