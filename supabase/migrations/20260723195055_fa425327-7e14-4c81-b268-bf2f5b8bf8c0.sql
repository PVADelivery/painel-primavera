
-- Drop overly permissive policies
DROP POLICY IF EXISTS "companies owner read" ON public.companies;
DROP POLICY IF EXISTS "companies marketplace public read" ON public.companies;

-- Owner/admin full read
CREATE POLICY "companies owner or admin read"
ON public.companies
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Public marketplace view exposing only non-sensitive columns
CREATE OR REPLACE VIEW public.companies_public
WITH (security_invoker = true) AS
SELECT
  id,
  name,
  logo_url,
  address,
  city_id,
  region_id,
  latitude,
  longitude,
  phone,
  is_active,
  show_in_marketplace,
  created_at
FROM public.companies
WHERE show_in_marketplace = true AND COALESCE(is_active, true) = true;

GRANT SELECT ON public.companies_public TO anon, authenticated;
