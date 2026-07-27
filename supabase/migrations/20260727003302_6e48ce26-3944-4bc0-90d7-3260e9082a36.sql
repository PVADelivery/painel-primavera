
DROP POLICY IF EXISTS companies_allow_all ON public.companies;
DROP POLICY IF EXISTS orders_allow_all ON public.orders;
DROP POLICY IF EXISTS regions_allow_all ON public.regions;
DROP POLICY IF EXISTS deliveries_allow_all ON public.deliveries;
DROP POLICY IF EXISTS addresses_allow_all ON public.addresses;
DROP POLICY IF EXISTS customers_allow_all ON public.customers;
DROP POLICY IF EXISTS invitations_allow_all ON public.invitations;
DROP POLICY IF EXISTS platform_settings_allow_all ON public.platform_settings;

-- Ensure admin has full control on platform_settings (was only permissive policy).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='platform_settings' AND policyname='platform_settings_admin_all') THEN
    CREATE POLICY platform_settings_admin_all ON public.platform_settings
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;
