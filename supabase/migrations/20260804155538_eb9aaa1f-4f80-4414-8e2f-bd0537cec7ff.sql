CREATE TABLE public.product_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  body text NOT NULL,
  author text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX product_notes_product_id_idx ON public.product_notes (product_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_notes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_notes TO authenticated;
GRANT ALL ON public.product_notes TO service_role;

ALTER TABLE public.product_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_notes_all ON public.product_notes FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER product_notes_updated_at
BEFORE UPDATE ON public.product_notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.product_notes (product_id, body, created_at)
SELECT id, notes, COALESCE(updated_at, now())
FROM public.products
WHERE notes IS NOT NULL AND btrim(notes) <> '';