-- 1. companies: enable RLS (policies already exist)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2. deliveries: enable RLS + scoped policies
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deliveries_select_scoped" ON public.deliveries;
CREATE POLICY "deliveries_select_scoped" ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = deliveries.company_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.delivery_drivers d WHERE d.id = deliveries.driver_id AND d.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "deliveries_insert_scoped" ON public.deliveries;
CREATE POLICY "deliveries_insert_scoped" ON public.deliveries
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = deliveries.company_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "deliveries_update_scoped" ON public.deliveries;
CREATE POLICY "deliveries_update_scoped" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = deliveries.company_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.delivery_drivers d WHERE d.id = deliveries.driver_id AND d.user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = deliveries.company_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.delivery_drivers d WHERE d.id = deliveries.driver_id AND d.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "deliveries_delete_admin" ON public.deliveries;
CREATE POLICY "deliveries_delete_admin" ON public.deliveries
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. ride_requests: enable RLS + scoped policies
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ride_requests_select_scoped" ON public.ride_requests;
CREATE POLICY "ride_requests_select_scoped" ON public.ride_requests
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.delivery_drivers d WHERE d.id = ride_requests.driver_id AND d.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "ride_requests_update_scoped" ON public.ride_requests;
CREATE POLICY "ride_requests_update_scoped" ON public.ride_requests
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.delivery_drivers d WHERE d.id = ride_requests.driver_id AND d.user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.delivery_drivers d WHERE d.id = ride_requests.driver_id AND d.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "ride_requests_delete_admin" ON public.ride_requests;
CREATE POLICY "ride_requests_delete_admin" ON public.ride_requests
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. delivery_drivers: re-harden insert to require driver/admin role
DROP POLICY IF EXISTS "drivers_insert_self_with_role" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Driver inserts own row" ON public.delivery_drivers;
CREATE POLICY "drivers_insert_self_with_role" ON public.delivery_drivers
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.has_role(auth.uid(), 'driver'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );