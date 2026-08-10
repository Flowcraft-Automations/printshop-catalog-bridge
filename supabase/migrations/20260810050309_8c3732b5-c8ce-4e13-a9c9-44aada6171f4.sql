ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS cost_per_m2 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outsource_area_m2 numeric,
  ADD COLUMN IF NOT EXISTS outsource_cost_per_m2 numeric;

CREATE TABLE IF NOT EXISTS public.business_config (
  id integer PRIMARY KEY DEFAULT 1,
  monthly_cost numeric NOT NULL DEFAULT 200000,
  monthly_revenue numeric NOT NULL DEFAULT 175000,
  overhead_factor numeric NOT NULL DEFAULT 2.0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_config TO anon;
GRANT ALL ON public.business_config TO service_role;

ALTER TABLE public.business_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY business_config_all ON public.business_config
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER business_config_updated_at
  BEFORE UPDATE ON public.business_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.business_config (id, monthly_cost, monthly_revenue, overhead_factor)
VALUES (1, 200000, 175000, 2.0)
ON CONFLICT (id) DO NOTHING;
