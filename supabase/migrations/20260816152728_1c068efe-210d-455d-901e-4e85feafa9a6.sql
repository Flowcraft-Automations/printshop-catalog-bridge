UPDATE public.families
SET outsource_width_cm = 9999,
    outsource_height_cm = 160,
    qty_exponent = 0.85,
    pricing_config = COALESCE(pricing_config, '{}'::jsonb) || jsonb_build_object('customer', jsonb_build_object(
      'method','area',
      'below', jsonb_build_object('base',20,'rate_m2',52,'min',40),
      'above', jsonb_build_object('base',0,'rate_m2',100,'min',0),
      'min_per_linear_m',55,
      'sheet', jsonb_build_object('setup',0,'price_per_sheet',0,'cost_per_sheet',0,'overrides','[]'::jsonb),
      'packages','[]'::jsonb,
      'rounding', jsonb_build_object('step',5,'direction','nearest')
    ))
WHERE family = 'שמשונית';

UPDATE public.families
SET outsource_width_cm = 20,
    outsource_height_cm = 20,
    qty_exponent = 1,
    pricing_config = COALESCE(pricing_config, '{}'::jsonb) || jsonb_build_object('customer', jsonb_build_object(
      'method','sheet_area',
      'below', jsonb_build_object('base',0,'rate_m2',0,'min',0),
      'above', jsonb_build_object('base',20,'rate_m2',52,'min',70),
      'min_per_linear_m',0,
      'sheet', jsonb_build_object('setup',94,'price_per_sheet',8,'cost_per_sheet',4,'overrides', jsonb_build_array(jsonb_build_object('size','5x5','units',30))),
      'packages', jsonb_build_array(100,150,200,250,500),
      'rounding', jsonb_build_object('step',1,'direction','nearest')
    ))
WHERE family = 'מדבקות';