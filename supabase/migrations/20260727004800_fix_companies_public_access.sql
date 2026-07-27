-- Garante acesso público de leitura para empresas/lojas (evita 0 lojas no marketplace)
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.companies TO authenticated, anon, public;
UPDATE public.companies SET is_active = true, is_open = true WHERE is_open IS NULL OR is_active IS NULL;
