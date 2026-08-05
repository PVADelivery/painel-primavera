-- 1. Companies: remove broad anon/authenticated read of all columns
DROP POLICY IF EXISTS "Lojas visíveis publicamente" ON public.companies;

-- 2. Remove legacy views (one was SECURITY DEFINER / security_invoker=off)
DROP VIEW IF EXISTS public.public_companies;
DROP VIEW IF EXISTS public.companies_public;

-- 3. Safe, column-limited public accessor for marketplace listings
CREATE OR REPLACE FUNCTION public.get_public_companies()
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  description text,
  logo_url text,
  cover_url text,
  banner_url text,
  rating numeric,
  delivery_fee numeric,
  prep_time integer,
  prep_time_min integer,
  prep_time_max integer,
  opening_hours jsonb,
  business_hours jsonb,
  is_open boolean,
  city text,
  state text,
  region_id uuid,
  city_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.category, c.description, c.logo_url, c.cover_url, c.banner_url,
         c.rating, c.delivery_fee, c.prep_time, c.prep_time_min, c.prep_time_max,
         c.opening_hours, c.business_hours, c.is_open, c.city, c.state, c.region_id, c.city_id
    FROM public.companies c
   WHERE COALESCE(c.show_in_marketplace, true)
     AND COALESCE(c.is_active, true);
$$;

REVOKE ALL ON FUNCTION public.get_public_companies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_companies() TO anon, authenticated, service_role;

-- 4. Driver self-enrollment hardening (codifies harden_driver_policies.sql)
DROP POLICY IF EXISTS "Driver inserts own row" ON public.delivery_drivers;
DROP POLICY IF EXISTS "Driver updates own row" ON public.delivery_drivers;
DROP POLICY IF EXISTS drivers_insert_self_with_role ON public.delivery_drivers;
CREATE POLICY drivers_insert_self_with_role
  ON public.delivery_drivers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.has_role(auth.uid(), 'driver'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

CREATE OR REPLACE FUNCTION public.prevent_driver_sensitive_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.commission_rate IS DISTINCT FROM OLD.commission_rate THEN
    NEW.commission_rate := OLD.commission_rate;
  END IF;
  IF NEW.rating IS DISTINCT FROM OLD.rating THEN
    NEW.rating := OLD.rating;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_drivers_lock_sensitive ON public.delivery_drivers;
CREATE TRIGGER trg_drivers_lock_sensitive
  BEFORE UPDATE ON public.delivery_drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_driver_sensitive_updates();

-- 5. Codify RLS for financial / messaging tables in tracked migrations
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.wallets TO authenticated;
GRANT SELECT, INSERT ON public.financial_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.wallets, public.financial_transactions, public.conversations, public.messages TO service_role;

DROP POLICY IF EXISTS wallets_select_own ON public.wallets;
CREATE POLICY wallets_select_own ON public.wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS wallets_insert_own ON public.wallets;
CREATE POLICY wallets_insert_own ON public.wallets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS wallets_update_own ON public.wallets;
CREATE POLICY wallets_update_own ON public.wallets FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS financial_transactions_select_own ON public.financial_transactions;
CREATE POLICY financial_transactions_select_own ON public.financial_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS financial_transactions_insert_admin ON public.financial_transactions;
CREATE POLICY financial_transactions_insert_admin ON public.financial_transactions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS conversations_select_participant ON public.conversations;
CREATE POLICY conversations_select_participant ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() = ANY (participants) OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS conversations_insert_participant ON public.conversations;
CREATE POLICY conversations_insert_participant ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = ANY (participants));
DROP POLICY IF EXISTS conversations_update_participant ON public.conversations;
CREATE POLICY conversations_update_participant ON public.conversations FOR UPDATE TO authenticated
  USING (auth.uid() = ANY (participants))
  WITH CHECK (auth.uid() = ANY (participants));

DROP POLICY IF EXISTS messages_select_participant ON public.messages;
CREATE POLICY messages_select_participant ON public.messages FOR SELECT TO authenticated
  USING (
    conversation_id IN (SELECT id FROM public.conversations WHERE auth.uid() = ANY (participants))
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );
DROP POLICY IF EXISTS messages_insert_participant ON public.messages;
CREATE POLICY messages_insert_participant ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (SELECT id FROM public.conversations WHERE auth.uid() = ANY (participants))
  );