-- Adiciona coluna de taxa de entrega para carros (car_price) na tabela public.regions
ALTER TABLE public.regions
  ADD COLUMN IF NOT EXISTS car_price NUMERIC(10,2) DEFAULT 0.00;

-- Concede permissões para acesso
GRANT ALL ON public.regions TO authenticated;
GRANT ALL ON public.regions TO anon;
GRANT ALL ON public.regions TO service_role;
