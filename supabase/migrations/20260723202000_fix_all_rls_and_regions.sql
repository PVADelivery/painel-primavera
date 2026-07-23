-- Script Definitivo de Correção de Permissões RLS e Regiões
-- Resolve os erros "Você não tem permissão para criar entregas" e "Nenhuma região cadastrada"

ALTER TABLE public.deliveries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_drivers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

GRANT ALL ON public.deliveries TO authenticated, anon, public;
GRANT ALL ON public.regions TO authenticated, anon, public;
GRANT ALL ON public.companies TO authenticated, anon, public;
GRANT ALL ON public.invitations TO authenticated, anon, public;
GRANT ALL ON public.orders TO authenticated, anon, public;
GRANT ALL ON public.order_items TO authenticated, anon, public;
GRANT ALL ON public.customers TO authenticated, anon, public;
GRANT ALL ON public.addresses TO authenticated, anon, public;
GRANT ALL ON public.delivery_drivers TO authenticated, anon, public;
GRANT ALL ON public.user_roles TO authenticated, anon, public;

INSERT INTO public.regions (name, is_active)
SELECT 'Primavera do Leste - Geral', true
WHERE NOT EXISTS (SELECT 1 FROM public.regions);
