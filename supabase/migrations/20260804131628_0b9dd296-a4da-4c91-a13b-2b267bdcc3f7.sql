CREATE TABLE public.product_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  field text NOT NULL,
  old_value text,
  new_value text,
  batch_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_history TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_history TO authenticated;
GRANT ALL ON public.product_history TO service_role;

ALTER TABLE public.product_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_history_all ON public.product_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX product_history_product_idx ON public.product_history (product_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_product_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b uuid := gen_random_uuid();
  src text := COALESCE(NEW.source, 'manual');
  cols text[] := ARRAY['name','family','width_cm','height_cm','qty','senzey_exists','senzey_ids','senzey_price','senzey_dup_count','site_exists','site_url','site_price','final_price','senzey_status','site_status','anomaly','notes','verified'];
  c text;
  o jsonb := to_jsonb(OLD);
  n jsonb := to_jsonb(NEW);
  ov text;
  nv text;
BEGIN
  FOREACH c IN ARRAY cols LOOP
    ov := o ->> c;
    nv := n ->> c;
    IF ov IS DISTINCT FROM nv THEN
      INSERT INTO public.product_history (product_id, field, old_value, new_value, batch_id, source)
      VALUES (NEW.id, c, ov, nv, b, src);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_log_changes
AFTER UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.log_product_changes();