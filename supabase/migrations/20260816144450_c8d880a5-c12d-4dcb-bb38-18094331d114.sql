UPDATE public.families
SET outsource_width_cm = 9999,
    outsource_height_cm = 160,
    pricing_config = COALESCE(pricing_config, '{}'::jsonb) || jsonb_build_object('customer', jsonb_build_object(
      'below', jsonb_build_object('base', 0, 'rate_m2', 73, 'min', 0),
      'above', jsonb_build_object('base', 0, 'rate_m2', 100, 'min', 0),
      'min_per_linear_m', 55,
      'sheet_mode', false,
      'sheet', jsonb_build_object('setup', 0, 'price_per_sheet', 0, 'cost_per_sheet', 0, 'units_per_sheet', 0, 'overrides', '[]'::jsonb),
      'rounding', jsonb_build_object('step', 5, 'direction', 'nearest')
    ))
WHERE family = 'שמשונית';

UPDATE public.families
SET outsource_width_cm = 20,
    outsource_height_cm = 20,
    pricing_config = COALESCE(pricing_config, '{}'::jsonb) || jsonb_build_object('customer', jsonb_build_object(
      'below', jsonb_build_object('base', 100, 'rate_m2', 0, 'min', 0),
      'above', jsonb_build_object('base', 70, 'rate_m2', 0, 'min', 70),
      'min_per_linear_m', 0,
      'sheet_mode', true,
      'sheet', jsonb_build_object('setup', 100, 'price_per_sheet', 26, 'cost_per_sheet', 0, 'units_per_sheet', 100, 'overrides', '[]'::jsonb),
      'rounding', jsonb_build_object('step', 1, 'direction', 'nearest')
    ))
WHERE family = 'מדבקות';