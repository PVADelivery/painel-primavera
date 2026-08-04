-- 1) ordering column on regions
ALTER TABLE public.regions ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 2) neighborhoods table
CREATE TABLE IF NOT EXISTS public.region_neighborhoods (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  region_id uuid NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS region_neighborhoods_region_name_key
  ON public.region_neighborhoods (region_id, lower(name));
CREATE INDEX IF NOT EXISTS region_neighborhoods_region_idx
  ON public.region_neighborhoods (region_id);

GRANT SELECT ON public.region_neighborhoods TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.region_neighborhoods TO authenticated;
GRANT ALL ON public.region_neighborhoods TO service_role;

ALTER TABLE public.region_neighborhoods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "region_neighborhoods_public_select" ON public.region_neighborhoods;
CREATE POLICY "region_neighborhoods_public_select"
ON public.region_neighborhoods FOR SELECT
TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.regions r WHERE r.id = region_id AND r.is_active = true)
       OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "region_neighborhoods_admin_write" ON public.region_neighborhoods;
CREATE POLICY "region_neighborhoods_admin_write"
ON public.region_neighborhoods FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_region_neighborhoods_updated_at ON public.region_neighborhoods;
CREATE TRIGGER update_region_neighborhoods_updated_at
BEFORE UPDATE ON public.region_neighborhoods
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) wipe old map-drawn regions (unlink historic deliveries first)
UPDATE public.deliveries SET region_id = NULL WHERE region_id IS NOT NULL;
UPDATE public.companies SET region_id = NULL WHERE region_id IS NOT NULL;
UPDATE public.addresses SET region_id = NULL WHERE region_id IS NOT NULL;
DELETE FROM public.pricing_rules;
DELETE FROM public.regions;

-- 4) seed the 5 official regions
INSERT INTO public.regions (id, name, color, price, is_active, sort_order) VALUES
  ('11111111-1111-4111-8111-000000000001', 'Região 1', '#22c55e', 8.00, true, 1),
  ('11111111-1111-4111-8111-000000000002', 'CENTRO - PVA 1 / JD RIVA 1/2/3/4', '#eab308', 10.00, true, 2),
  ('11111111-1111-4111-8111-000000000003', 'REGIÃO 3', '#3b82f6', 12.00, true, 3),
  ('11111111-1111-4111-8111-000000000004', 'REGIÃO 4', '#a855f7', 15.00, true, 4),
  ('11111111-1111-4111-8111-000000000005', 'Região 5', '#ef4444', 20.00, true, 5);

-- 5) neighborhoods
INSERT INTO public.region_neighborhoods (region_id, name, sort_order)
SELECT '11111111-1111-4111-8111-000000000002', n, ord FROM (VALUES
  ('ATLATICO SUL',1),('BELA VISTA',2),('BELVEDELE',3),('CASTELADIA 1/2/3/4',4),
  ('CENTRO LESTE',5),('COAB JAIME CAMPOS',6),('COAB TRANCREDO NEVES',7),
  ('COND. CIDADE JARDIM',8),('COND. PADOVA',9),('COND. ROMANA',10),('COND. VENETO',11),
  ('CRISTO REI - FELIZ NATAL',12),('DISTRITO INDUSTRIAL ATÉ POSTO ALDO / SHELL',13),
  ('GNOATO',14),('JD DAS AMERICA 1/2/3',15),('JD ITALIA',16),('JD MARINGA',17),
  ('JD MILANO',18),('JD PROGRESSO',19),('JD SERRA DAS FLORES',20),
  ('JD UNIVERSITARIO - PARMA 1',21),('JD VENEZA',22),('JD VITORIA',23),
  ('JD VOLTA GRANDE',24),('NOVO HORIZONTE',25),('PARQUE DA ÁGUAS',26),
  ('PARQUE ELDORADO',27),('PIONEIRO',28),('PONCHO VERDE 1/2',29),('PVA 2',30),
  ('PVA 4',31),('SANTA CLARA',32),('SÃO CRISTOVÃO 1/2/3',33),('SÃO JOSE',34),
  ('VERTERTES DAS ÁGUAS',35),('VILA POPULAR',36)
) AS t(n, ord);

INSERT INTO public.region_neighborhoods (region_id, name, sort_order)
SELECT '11111111-1111-4111-8111-000000000003', n, ord FROM (VALUES
  ('BURITIS 1/2/3/4/5',1),('CHACARA FONTANA',2),('COND. PORTO SEGURO',3),
  ('COND. SPLERODE (ENTRADA EUROPA)',4),('COND. TERRAZ',5),
  ('DISTRITO INDUSTRIAL ATRAS SHELL (ALVORADA)',6),('GÜTERRES',7),
  ('INDUSTRIAL JOSE DE ALENCAR',8),('JD 3 AMERICAS 1/2',9),
  ('JD FLORENÇA - VILA GRAMADO',10),('JD LUCIANA 1/2',11),('JD NOVA ESPERANÇA',12),
  ('PONCHO VERDE 3/4/5',13),('PVA 3 - PADRE ONESTO COSTA',14),('TUIUIU',15)
) AS t(n, ord);

INSERT INTO public.region_neighborhoods (region_id, name, sort_order)
SELECT '11111111-1111-4111-8111-000000000004', n, ord FROM (VALUES
  ('ATÉ ROYAL - POLICIA PRF - CARGIL',1),('BURITIS PRIME - BURITIS 6',2),
  ('BURITIS UNIVERSITARIO 1/2 - FASIPE',3),('JD DOS IPES (CASAS PACAEMBU)',4),
  ('JD EUROPA',5),('MT 130 - FENDT - IGUAÇU MAQUINAS',6),
  ('SAIDA PRA BARRA - NA KAOPPA',7),('SANTA FELICIDADE',8)
) AS t(n, ord);