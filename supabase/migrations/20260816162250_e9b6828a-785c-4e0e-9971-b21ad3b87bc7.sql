UPDATE public.families
SET outsource_width_cm = 160,
    outsource_height_cm = 150,
    cost_per_m2 = 20,
    outsource_cost_per_m2 = 80,
    pricing_config = jsonb_build_object('v3', jsonb_build_object(
      'method','area','margin',1.3,'rounding',5,
      'packages','[]'::jsonb,'sheet_units','{}'::jsonb))
WHERE family = 'שמשונית';

UPDATE public.families
SET outsource_width_cm = 20,
    outsource_height_cm = 20,
    cost_per_m2 = 5,
    outsource_cost_per_m2 = 80,
    pricing_config = jsonb_build_object('v3', jsonb_build_object(
      'method','sheet','margin',1.3,'rounding',5,
      'packages','[100,150,200,250,500]'::jsonb,
      'sheet_units','{"5x5":30}'::jsonb))
WHERE family = 'מדבקות';

INSERT INTO public.products (row_key, name, family, width_cm, height_cm, qty, final_price, is_anchor, source)
SELECT 'anchor-stickers-5x5-100', 'מדבקות 5/5 — 100 יח׳', 'מדבקות', 5, 5, 100, 126, true, 'calculator'
WHERE NOT EXISTS (
  SELECT 1 FROM public.products
  WHERE family = 'מדבקות' AND width_cm = 5 AND height_cm = 5 AND qty = 100);

INSERT INTO public.products (row_key, name, family, width_cm, height_cm, qty, final_price, is_anchor, source)
SELECT 'anchor-stickers-5x5-500', 'מדבקות 5/5 — 500 יח׳', 'מדבקות', 5, 5, 500, 230, true, 'calculator'
WHERE NOT EXISTS (
  SELECT 1 FROM public.products
  WHERE family = 'מדבקות' AND width_cm = 5 AND height_cm = 5 AND qty = 500);

UPDATE public.products SET is_anchor = true, final_price = 126
WHERE family = 'מדבקות' AND width_cm = 5 AND height_cm = 5 AND qty = 100;

UPDATE public.products SET is_anchor = true, final_price = 230
WHERE family = 'מדבקות' AND width_cm = 5 AND height_cm = 5 AND qty = 500;

ALTER TABLE public.families
  DROP COLUMN IF EXISTS rate_m2,
  DROP COLUMN IF EXISTS base_price,
  DROP COLUMN IF EXISTS qty_exponent,
  DROP COLUMN IF EXISTS qty_discounts,
  DROP COLUMN IF EXISTS min_charge,
  DROP COLUMN IF EXISTS outsource_area_m2;