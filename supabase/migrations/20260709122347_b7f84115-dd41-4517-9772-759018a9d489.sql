
-- Enable RLS on tables that have policies but RLS disabled
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_cash_flow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Drop broad SELECT policies on public storage buckets to prevent listing.
-- Public buckets still serve files via public URL without a SELECT policy.
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
DROP POLICY IF EXISTS "store_assets_public_read" ON storage.objects;
