CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_key text UNIQUE NOT NULL,
  name text NOT NULL,
  family text,
  width_cm numeric,
  height_cm numeric,
  qty integer DEFAULT 1,
  senzey_exists boolean DEFAULT false,
  senzey_ids text,
  senzey_price numeric,
  senzey_dup_count integer DEFAULT 0,
  site_exists boolean DEFAULT false,
  site_url text,
  site_price numeric,
  final_price numeric,
  senzey_status text DEFAULT 'to_review',
  site_status text DEFAULT 'to_review',
  anomaly text,
  notes text,
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.families (
  family text PRIMARY KEY,
  items_count integer,
  rate_m2 numeric,
  min_charge numeric,
  qty_discounts jsonb DEFAULT '[]'::jsonb,
  notes text
);

CREATE TABLE public.app_config (
  id int PRIMARY KEY,
  password text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.families TO anon, authenticated;
GRANT SELECT ON public.app_config TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
GRANT ALL ON public.families TO service_role;
GRANT ALL ON public.app_config TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_all" ON public.products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "families_all" ON public.families FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "app_config_read" ON public.app_config FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX products_family_idx ON public.products (family);
CREATE INDEX products_site_status_idx ON public.products (site_status);
CREATE INDEX products_senzey_status_idx ON public.products (senzey_status);

INSERT INTO public.app_config (id, password) VALUES (1, 'mdvd2026');