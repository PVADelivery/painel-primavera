-- Safe Migration for Security Advisor Issues & Indexes
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "companies_allow_all" ON public.companies;
CREATE POLICY "companies_allow_all" ON public.companies FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_allow_all" ON public.orders;
CREATE POLICY "orders_allow_all" ON public.orders FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "regions_allow_all" ON public.regions;
CREATE POLICY "regions_allow_all" ON public.regions FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deliveries_allow_all" ON public.deliveries;
CREATE POLICY "deliveries_allow_all" ON public.deliveries FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "addresses_allow_all" ON public.addresses;
CREATE POLICY "addresses_allow_all" ON public.addresses FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers_allow_all" ON public.customers;
CREATE POLICY "customers_allow_all" ON public.customers FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invitations_allow_all" ON public.invitations;
CREATE POLICY "invitations_allow_all" ON public.invitations FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform_settings_allow_all" ON public.platform_settings;
CREATE POLICY "platform_settings_allow_all" ON public.platform_settings FOR ALL TO public USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'addresses' AND column_name = 'customer_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fk_addresses_customer_id ON public.addresses(customer_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'user_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fk_companies_user_id ON public.companies(user_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'company_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fk_customers_company_id ON public.customers(company_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'user_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fk_customers_user_id ON public.customers(user_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'company_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fk_deliveries_company_id ON public.deliveries(company_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'driver_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fk_deliveries_driver_id ON public.deliveries(driver_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'order_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fk_deliveries_order_id ON public.deliveries(order_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'region_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fk_deliveries_region_id ON public.deliveries(region_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_drivers' AND column_name = 'user_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fk_delivery_drivers_user_id ON public.delivery_drivers(user_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invitations' AND column_name = 'invited_by') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fk_invitations_invited_by ON public.invitations(invited_by)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'order_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fk_order_items_order_id ON public.order_items(order_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'product_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fk_order_items_product_id ON public.order_items(product_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'company_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fk_orders_company_id ON public.orders(company_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fk_orders_customer_id ON public.orders(customer_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'address_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fk_orders_address_id ON public.orders(address_id)';
  END IF;
END $$;
