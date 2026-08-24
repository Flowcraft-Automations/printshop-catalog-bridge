# MDVD Catalog Sync

Lovable Prompt — MDVD Catalog Migration Console

Copy everything below the line into Lovable as the first prompt. Connect Supabase when asked. Then use the app's Import page to upload MDVD_app_seed_data.xlsx.

Build an internal catalog-migration console for an Israeli print shop ("דפוס MDVD"). The business sells through two disconnected systems: an iStores website and Senzey (ERP). This app is the single workspace to reconcile them: see every product's presence and price in each system, decide final prices, add new products, and track the manual migration work into both systems.

Tech & general

React + Tailwind + shadcn/ui, Supabase for database.

Entire UI in Hebrew, RTL layout (dir="rtl"), font: Heebo (Google Fonts). Clean light theme, accent color #1F4E79.

Single shared user. Password gate: a login screen with one password field, checked against a password value stored in a Supabase table app_config (single row; I will set the value directly in Supabase). On success store a flag in localStorage and skip login next time. Add a logout button. No email auth.

Database schema (Supabase)

table products:

id uuid pk default gen_random_uuid()

row_key text unique not null (stable import key)

name text not null

family text

width_cm numeric null, height_cm numeric null, qty integer default 1

senzey_exists boolean default false

senzey_ids text

senzey_price numeric null

senzey_dup_count integer default 0

site_exists boolean default false

site_url text

site_price numeric null

final_price numeric null

senzey_status text default 'to_review' — allowed: exists / to_review / to_add / in_progress / done / not_relevant

site_status text default 'to_review' — same values

anomaly text

notes text

source text default 'manual' (import | manual)

created_at timestamptz default now(), updated_at timestamptz default now()

table families:

family text pk

items_count integer

rate_m2 numeric null (₪ per square meter, incl. VAT)

min_charge numeric null (minimum price per unit, ₪)

qty_discounts jsonb default '[]' (e.g. [{"min":10,"mult":0.85},{"min":20,"mult":0.75}])

notes text

table app_config: id int pk, password text.

RLS: enable with permissive policies for anon (internal tool behind the password gate).

Pages

1. לוח בקרה (Dashboard)

KPI cards: סה"כ פריטים · קיים בשתי המערכות · רק באתר · רק בסנזיי · חריגות מחיר (anomaly not empty) · פערי מחיר (notes contains "פער מחיר"). Migration progress: for each of site/senzey, counts of to_add / in_progress / done and a progress bar (done ÷ (to_add+in_progress+done)). Per-family table: family, items, on-site count, in-senzey count, pending migration count. Clicking a family opens the catalog filtered to it.

2. קטלוג (main screen)

A dense, fast table of all products with:

Search by name; filters: family, senzey_status, site_status, "רק חריגות", "רק פערי מחיר", presence (בשתי המערכות / רק אתר / רק סנזיי).

Columns: שם | משפחה | מידה (width/height) | כמות | מחיר סנזיי | מחיר אתר | מחיר סופי (inline editable) | סטטוס סנזיי (inline select) | סטטוס אתר (inline select) | קישור לאתר (external-link icon when site_url exists) | badges: חריגה (red, tooltip = anomaly text), כפילות (when senzey_dup_count > 1).

Row click opens an edit drawer with all fields + notes.

Bulk selection with bulk status change.

Status labels in Hebrew: exists=קיים · to_review=לבחינה · to_add=להוספה · in_progress=בתהליך · done=בוצע · not_relevant=לא רלוונטי. Color coding: exists gray, to_review yellow, to_add blue, in_progress orange, done green, not_relevant muted.

3. הוספת מוצר חדש

Form: name, family (select from families + free text), width/height, qty, final_price, notes. On save: source='manual', senzey_status='to_add', site_status='to_add', row_key = slugified name + timestamp. Button available from the catalog header and from the calculator (prefilled).

4. רשימת הגירה (Migration board)

Two tabs: "להזנה לאתר" and "להזנה לסנזיי". Each lists products whose corresponding status is to_add or in_progress, grouped by family, showing name, size, qty, final_price (highlight red if missing — must be set before migrating), notes. Per-row buttons: התחל (→in_progress), בוצע (→done, stamps updated_at), לא רלוונטי. A "בוצע" tab per system for history. This board is the day-to-day work tracker.

5. מחשבון מידות (Size calculator)

Select family → load rate_m2, min_charge, qty_discounts from families.

Inputs: width cm, height cm, quantity.

Computation: area = w×h/10000; unit = max(rate_m2 × area, min_charge); apply the highest matching qty discount multiplier; total = unit × qty; round unit to nearest 1 ₪. Show unit price, total, and the formula breakdown.

Below the result: "מוצרים קיימים דומים" — products of the same family with area within ±25%, showing their size, qty and senzey_price, so the curve can be sanity-checked against reality.

Button "צור מוצר מהחישוב" → opens the Add-product form prefilled (name auto-suggested like "הדפסה על {family} {w}/{h}", final_price = computed).

Admin section on this page: editable table of families (rate_m2, min_charge, qty_discounts as a simple tier editor) — this is where pricing curves are tuned.

6. ייבוא נתונים (Import)

Upload an .xlsx file with two sheets exactly as specified:

Sheet products, columns: row_key, name, family, width_cm, height_cm, qty, senzey_exists, senzey_ids, senzey_price, senzey_dup_count, site_exists, site_url, site_price, final_price, senzey_status, site_status, anomaly, notes, source.

Sheet families, columns: family, items_count, rate_m2, min_charge, notes. Parse client-side with the xlsx (SheetJS) library. Upsert by row_key (products) / family (families): update existing rows' data columns but never overwrite final_price, statuses, or notes for rows that already exist (so re-imports don't erase manual work). Show a preview (counts of new/updated) before commit and a result summary after.

Definition of done

Password gate works; all pages in Hebrew RTL; import of the attached file succeeds with ~1,049 products and ~32 families; statuses editable inline; migration board reflects status changes instantly; calculator computes from families table and can create a product.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mdvd-catalog-sync.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8f34e6e0-6648-4ff5-81d4-32f5901dab26).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
