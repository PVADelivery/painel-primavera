-- Adiciona coluna de taxa de entrega para carros (car_price) na tabela public.regions
ALTER TABLE public.regions
  ADD COLUMN IF NOT EXISTS car_price NUMERIC(10,2) DEFAULT 0.00;

-- Adiciona coluna de valor para carros (car_base_value) na tabela public.pricing_rules
ALTER TABLE public.pricing_rules
  ADD COLUMN IF NOT EXISTS car_base_value NUMERIC(10,2) DEFAULT 0.00;

-- Concede permissões para acesso
GRANT ALL ON public.regions TO authenticated, anon, service_role;
GRANT ALL ON public.pricing_rules TO authenticated, anon, service_role;
