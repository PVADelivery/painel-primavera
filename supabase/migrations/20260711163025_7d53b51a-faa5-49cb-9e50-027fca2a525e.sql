
CREATE TABLE public.business_directory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Tudo',
  phone TEXT,
  whatsapp TEXT,
  address TEXT,
  website TEXT,
  hours TEXT,
  rating NUMERIC DEFAULT 5,
  featured BOOLEAN NOT NULL DEFAULT false,
  card_image_url TEXT,
  card_style TEXT DEFAULT 'dark',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.business_directory TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_directory TO authenticated;
GRANT ALL ON public.business_directory TO service_role;

ALTER TABLE public.business_directory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_directory_public_read" ON public.business_directory
  FOR SELECT USING (true);

CREATE POLICY "business_directory_admin_all" ON public.business_directory
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_business_directory_updated_at
  BEFORE UPDATE ON public.business_directory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
