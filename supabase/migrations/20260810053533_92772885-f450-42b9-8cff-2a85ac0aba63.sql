ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS outsource_width_cm numeric,
  ADD COLUMN IF NOT EXISTS outsource_height_cm numeric;

UPDATE public.families
  SET outsource_width_cm = 150,
      outsource_height_cm = 160
  WHERE outsource_width_cm IS NULL AND outsource_height_cm IS NULL;

COMMENT ON COLUMN public.families.outsource_width_cm IS 'Minimum width (cm) for outsourcing threshold';
COMMENT ON COLUMN public.families.outsource_height_cm IS 'Minimum height (cm) for outsourcing threshold';