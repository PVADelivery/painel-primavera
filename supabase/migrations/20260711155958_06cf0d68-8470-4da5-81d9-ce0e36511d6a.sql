
-- Enable RLS on tables missing it
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Force RLS on privileged tables so table owner is also constrained
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

-- Fix driver self-enrollment: drop permissive insert policy
DROP POLICY IF EXISTS drivers_insert_own ON public.delivery_drivers;
