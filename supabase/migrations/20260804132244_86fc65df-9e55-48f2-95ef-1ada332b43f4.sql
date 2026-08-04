ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS senzey_group text DEFAULT '',
  ADD COLUMN IF NOT EXISTS site_category text DEFAULT '',
  ADD COLUMN IF NOT EXISTS competitor_price numeric,
  ADD COLUMN IF NOT EXISTS competitor_ref text DEFAULT '',
  ADD COLUMN IF NOT EXISTS proposed_price numeric;