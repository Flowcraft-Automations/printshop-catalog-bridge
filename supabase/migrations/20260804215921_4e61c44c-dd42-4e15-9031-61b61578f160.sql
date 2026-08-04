ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_anchor boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS products_family_anchor_idx ON public.products (family, is_anchor);
CREATE OR REPLACE FUNCTION public.log_product_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  b uuid := gen_random_uuid();
  src text := COALESCE(NEW.source, 'manual');
  cols text[] := ARRAY['name','family','width_cm','height_cm','qty','senzey_exists','senzey_ids','senzey_price','senzey_dup_count','site_exists','site_url','site_price','final_price','senzey_status','site_status','anomaly','notes','verified','is_anchor'];
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
$function$;