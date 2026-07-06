
-- companies: scope SELECT
DROP POLICY IF EXISTS "Companies readable by authenticated" ON public.companies;

CREATE POLICY "Companies readable by involved parties"
ON public.companies
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.deliveries d
    JOIN public.delivery_drivers dd ON dd.id = d.driver_id
    WHERE d.company_id = companies.id AND dd.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.deliveries d
    JOIN public.customers c ON c.id::text = d.customer_name -- fallback no-op
    WHERE d.company_id = companies.id AND c.user_id = auth.uid()
  )
);

-- delivery_drivers: scope company visibility to drivers assigned to that company's deliveries
DROP POLICY IF EXISTS "Drivers see own profile" ON public.delivery_drivers;

CREATE POLICY "Drivers visible to self admin and related companies"
ON public.delivery_drivers
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.deliveries d
    JOIN public.companies c ON c.id = d.company_id
    WHERE d.driver_id = delivery_drivers.id AND c.user_id = auth.uid()
  )
);
