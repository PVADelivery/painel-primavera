
-- === Security hardening: replace permissive USING(true) policies with scoped ones ===

-- ADDRESSES
DROP POLICY IF EXISTS "addresses_select_all" ON public.addresses;
DROP POLICY IF EXISTS "addresses_insert_all" ON public.addresses;

CREATE POLICY "addresses_select_owner_or_admin" ON public.addresses
  FOR SELECT TO authenticated
  USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "addresses_insert_owner" ON public.addresses
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "addresses_update_owner" ON public.addresses
  FOR UPDATE TO authenticated
  USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "addresses_delete_owner" ON public.addresses
  FOR DELETE TO authenticated
  USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- CUSTOMERS
DROP POLICY IF EXISTS "customers_select_all" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_all" ON public.customers;

CREATE POLICY "customers_select_self_or_admin" ON public.customers
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'company'::public.app_role)
    OR public.has_role(auth.uid(), 'driver'::public.app_role)
  );

CREATE POLICY "customers_insert_self" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- DELIVERIES: remove permissive select/insert/update; keep scoped driver_access; add company + admin + insert-by-company
DROP POLICY IF EXISTS "deliveries_select_stable" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_insert_stable" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_manage_stable" ON public.deliveries;

CREATE POLICY "deliveries_select_company_admin_customer" ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR order_id IN (SELECT o.id FROM public.orders o WHERE o.user_id = auth.uid())
  );

CREATE POLICY "deliveries_insert_company_or_admin" ON public.deliveries
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY "deliveries_update_owner_or_driver" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR (driver_id IS NOT NULL AND driver_id = public.get_driver_id(auth.uid()))
    OR (driver_id IS NULL AND public.is_driver(auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR (driver_id IS NOT NULL AND driver_id = public.get_driver_id(auth.uid()))
  );

CREATE POLICY "deliveries_delete_admin_or_company" ON public.deliveries
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- INVITATIONS
DROP POLICY IF EXISTS "invitations_select_all" ON public.invitations;

CREATE POLICY "invitations_select_admin_or_invitee" ON public.invitations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR email = (SELECT au.email FROM auth.users au WHERE au.id = auth.uid())
  );

-- ORDERS
DROP POLICY IF EXISTS "orders_select_all" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_all" ON public.orders;
DROP POLICY IF EXISTS "orders_update_all" ON public.orders;

CREATE POLICY "orders_insert_customer_or_company" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "orders_update_owner_company_admin" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  );

-- PROFILES
DROP POLICY IF EXISTS "Profiles_Final_Select" ON public.profiles;

-- USER_ROLES
DROP POLICY IF EXISTS "user_roles_read_all" ON public.user_roles;

CREATE POLICY "user_roles_select_self_or_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- COUPON_PRODUCTS: scope to active coupons only
DROP POLICY IF EXISTS "coupon_products_select_public" ON public.coupon_products;

CREATE POLICY "coupon_products_select_active" ON public.coupon_products
  FOR SELECT TO public
  USING (
    EXISTS (SELECT 1 FROM public.coupons c WHERE c.id = coupon_products.coupon_id AND c.active = true)
  );

-- ORDER_ITEMS
DROP POLICY IF EXISTS "order_items_select_all" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_all" ON public.order_items;

CREATE POLICY "order_items_select_via_order" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.user_id = auth.uid()
         OR o.customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
         OR o.company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "order_items_insert_via_order" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.user_id = auth.uid()
         OR o.customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
         OR o.company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- PLATFORM_CASH_FLOW: drop permissive policy
DROP POLICY IF EXISTS "Allow authenticated users full access to cash flow" ON public.platform_cash_flow;

-- PRODUCTS
DROP POLICY IF EXISTS "products_insert_own" ON public.products;
DROP POLICY IF EXISTS "products_update_own" ON public.products;
DROP POLICY IF EXISTS "products_delete_own" ON public.products;

CREATE POLICY "products_insert_own_company" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "products_update_own_company" ON public.products
  FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "products_delete_own_company" ON public.products
  FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- SYSTEM_INVITATIONS
DROP POLICY IF EXISTS "Allow authenticated full access to system_invitations" ON public.system_invitations;

CREATE POLICY "system_invitations_admin_all" ON public.system_invitations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- OCCURRENCES insert scoping
DROP POLICY IF EXISTS "occurrences_insert_own" ON public.occurrences;

CREATE POLICY "occurrences_insert_own_driver" ON public.occurrences
  FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = public.get_driver_id(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'company'::public.app_role)
  );

-- REVIEWS insert scoping (must be a delivery the caller was customer for)
DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;

CREATE POLICY "reviews_insert_own_delivery" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    delivery_id IN (
      SELECT d.id FROM public.deliveries d
      JOIN public.orders o ON o.id = d.order_id
      WHERE o.user_id = auth.uid()
         OR o.customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Add owner-scoped policies for tables flagged as missing them (fail-closed if unset)
-- Ensure RLS enabled
ALTER TABLE public.driver_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "driver_earnings_owner_select" ON public.driver_earnings;
CREATE POLICY "driver_earnings_owner_select" ON public.driver_earnings
  FOR SELECT TO authenticated
  USING (
    driver_id = public.get_driver_id(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "delivery_occurrences_owner_select" ON public.delivery_occurrences;
CREATE POLICY "delivery_occurrences_owner_select" ON public.delivery_occurrences
  FOR SELECT TO authenticated
  USING (
    driver_id = public.get_driver_id(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR delivery_id IN (SELECT id FROM public.deliveries d WHERE d.company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "driver_location_history_owner_select" ON public.driver_location_history;
CREATE POLICY "driver_location_history_owner_select" ON public.driver_location_history
  FOR SELECT TO authenticated
  USING (
    driver_id = public.get_driver_id(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "driver_location_history_owner_insert" ON public.driver_location_history;
CREATE POLICY "driver_location_history_owner_insert" ON public.driver_location_history
  FOR INSERT TO authenticated
  WITH CHECK (driver_id = public.get_driver_id(auth.uid()));

DROP POLICY IF EXISTS "delivery_ratings_public_select" ON public.delivery_ratings;
CREATE POLICY "delivery_ratings_public_select" ON public.delivery_ratings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "withdrawals_owner_select" ON public.withdrawals;
CREATE POLICY "withdrawals_owner_select" ON public.withdrawals
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "notifications_owner_select" ON public.notifications;
CREATE POLICY "notifications_owner_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "notifications_owner_update" ON public.notifications;
CREATE POLICY "notifications_owner_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "chat_sessions_participant_select" ON public.chat_sessions;
CREATE POLICY "chat_sessions_participant_select" ON public.chat_sessions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "payments_owner_select" ON public.payments;
CREATE POLICY "payments_owner_select" ON public.payments
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR order_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.user_id = auth.uid()
         OR o.customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
         OR o.company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  );

-- === Function search_path hardening ===
ALTER FUNCTION public.notify_driver_trigger() SET search_path = public;
ALTER FUNCTION public.create_invitation(text, text, uuid, uuid, timestamptz) SET search_path = public;
ALTER FUNCTION public.create_admin_user(text, text, text, text, text, text, text, text, uuid, double precision, double precision) SET search_path = public;
ALTER FUNCTION public.create_admin_user(text, text, text, text, text, text, text, text, uuid, double precision, double precision, text, text, double precision) SET search_path = public;
ALTER FUNCTION public.create_admin_user(jsonb) SET search_path = public;

-- === Storage: prevent listing of public avatars bucket (public URLs still work via CDN) ===
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
