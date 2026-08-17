
DROP POLICY IF EXISTS "Drivers read companies of their deliveries" ON public.companies;
DROP POLICY IF EXISTS "companies_public_read" ON public.companies;

CREATE OR REPLACE FUNCTION public.get_delivery_company_info(_company_id uuid)
RETURNS TABLE(id uuid, name text, phone text, address text, logo_url text, latitude double precision, longitude double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.phone, c.address, c.logo_url, c.latitude, c.longitude
  FROM public.companies c
  WHERE c.id = _company_id
    AND (
      c.user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.driver_can_read_company(auth.uid(), c.id)
    )
$$;

REVOKE ALL ON FUNCTION public.get_delivery_company_info(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_delivery_company_info(uuid) TO authenticated;
