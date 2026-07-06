
-- ============ COMPANIES ============
DROP POLICY IF EXISTS "companies_select_all" ON public.companies;
-- 'Anyone can view active and visible companies' policy remains (owner + admin + marketplace)

-- ============ DELIVERY_DRIVERS ============
DROP POLICY IF EXISTS "Drivers_Final_Select" ON public.delivery_drivers;
CREATE POLICY "drivers_select_scoped" ON public.delivery_drivers
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'company'::public.app_role)
  );

DROP POLICY IF EXISTS "Drivers_Final_Insert" ON public.delivery_drivers;
CREATE POLICY "drivers_insert_self_with_role" ON public.delivery_drivers
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.has_role(auth.uid(), 'driver'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

-- ============ OCCURRENCES ============
DROP POLICY IF EXISTS "occurrences_select_all" ON public.occurrences;
CREATE POLICY "occurrences_select_scoped" ON public.occurrences
  FOR SELECT TO authenticated
  USING (
    driver_id = public.get_driver_id(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR delivery_id IN (
      SELECT d.id FROM public.deliveries d
      WHERE d.company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  );

-- ============ DELIVERY_RATINGS ============
DROP POLICY IF EXISTS "delivery_ratings_public_select" ON public.delivery_ratings;
CREATE POLICY "delivery_ratings_scoped_select" ON public.delivery_ratings
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR driver_id = public.get_driver_id(auth.uid())
    OR delivery_id IN (
      SELECT d.id FROM public.deliveries d
      LEFT JOIN public.orders o ON o.id = d.order_id
      WHERE d.company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
         OR o.user_id = auth.uid()
         OR o.customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
    )
  );

-- ============ PRODUCTS ============
DROP POLICY IF EXISTS "products_select_all" ON public.products;
DROP POLICY IF EXISTS "products_select_policy" ON public.products;
CREATE POLICY "products_select_public_active" ON public.products
  FOR SELECT TO public
  USING (
    is_active = true
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- ============ REGIONS ============
DROP POLICY IF EXISTS "regions_select_all" ON public.regions;
CREATE POLICY "regions_select_active" ON public.regions
  FOR SELECT TO public
  USING (
    is_active = true
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- ============ WALLETS ============
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallets_select_own" ON public.wallets;
CREATE POLICY "wallets_select_own" ON public.wallets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "wallets_insert_own" ON public.wallets;
CREATE POLICY "wallets_insert_own" ON public.wallets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Balance changes must go through server-side function only. No client UPDATE policy.

DROP TRIGGER IF EXISTS trg_wallets_updated_at ON public.wallets;
CREATE TRIGGER trg_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FINANCIAL_TRANSACTIONS ============
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  related_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.financial_transactions TO authenticated;
GRANT ALL ON public.financial_transactions TO service_role;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financial_transactions_select_own" ON public.financial_transactions;
CREATE POLICY "financial_transactions_select_own" ON public.financial_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Inserts happen only via SECURITY DEFINER functions / service role. No client INSERT/UPDATE/DELETE policies.

-- ============ CONVERSATIONS ============
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  participants UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant" ON public.conversations
  FOR SELECT TO authenticated
  USING (
    auth.uid() = ANY(participants)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "conversations_insert_participant" ON public.conversations;
CREATE POLICY "conversations_insert_participant" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = ANY(participants));

DROP POLICY IF EXISTS "conversations_update_participant" ON public.conversations;
CREATE POLICY "conversations_update_participant" ON public.conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() = ANY(participants))
  WITH CHECK (auth.uid() = ANY(participants));

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON public.conversations;
CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ MESSAGES ============
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant" ON public.messages
  FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations WHERE auth.uid() = ANY(participants)
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "messages_insert_participant" ON public.messages;
CREATE POLICY "messages_insert_participant" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT id FROM public.conversations WHERE auth.uid() = ANY(participants)
    )
  );
