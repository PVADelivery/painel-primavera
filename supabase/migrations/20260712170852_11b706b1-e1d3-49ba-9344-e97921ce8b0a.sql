
-- 1. Fix deliveries permissive policies (SELECT/INSERT/UPDATE using true)
DROP POLICY IF EXISTS deliveries_select_master ON public.deliveries;
DROP POLICY IF EXISTS deliveries_insert_master ON public.deliveries;
DROP POLICY IF EXISTS deliveries_update_master ON public.deliveries;

CREATE POLICY deliveries_select_scoped ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR (driver_id IS NOT NULL AND driver_id = get_driver_id(auth.uid()))
    OR (driver_id IS NULL AND status IN ('pending'::delivery_status, 'broadcasted'::delivery_status)
        AND EXISTS (SELECT 1 FROM public.delivery_drivers dd WHERE dd.user_id = auth.uid() AND dd.status = 'active'))
  );

CREATE POLICY deliveries_insert_scoped ON public.deliveries
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

CREATE POLICY deliveries_update_scoped ON public.deliveries
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR (driver_id IS NOT NULL AND driver_id = get_driver_id(auth.uid()))
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR (driver_id IS NOT NULL AND driver_id = get_driver_id(auth.uid()))
  );

-- 2. business_directory: restrict public read to authenticated users
DROP POLICY IF EXISTS business_directory_public_read ON public.business_directory;
CREATE POLICY business_directory_authenticated_read ON public.business_directory
  FOR SELECT TO authenticated
  USING (true);

-- 3. Harden delivery_drivers: prevent drivers from editing commission_rate / rating
CREATE OR REPLACE FUNCTION public.prevent_driver_sensitive_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
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

-- Tighten UPDATE policy WITH CHECK so driver can't change user_id
DROP POLICY IF EXISTS "Drivers_Final_Update" ON public.delivery_drivers;
CREATE POLICY drivers_update_own ON public.delivery_drivers
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 4. Bring untracked financial/messaging tables under migration control
-- Re-declare RLS + policies idempotently
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallets_select_own ON public.wallets;
CREATE POLICY wallets_select_own ON public.wallets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS wallets_insert_own ON public.wallets;
CREATE POLICY wallets_insert_own ON public.wallets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS wallets_update_own ON public.wallets;
CREATE POLICY wallets_update_own ON public.wallets
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS financial_transactions_select_own ON public.financial_transactions;
CREATE POLICY financial_transactions_select_own ON public.financial_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS financial_transactions_insert_admin ON public.financial_transactions;
CREATE POLICY financial_transactions_insert_admin ON public.financial_transactions
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS conversations_select_participant ON public.conversations;
CREATE POLICY conversations_select_participant ON public.conversations
  FOR SELECT TO authenticated
  USING (auth.uid() = ANY (participants) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS conversations_insert_participant ON public.conversations;
CREATE POLICY conversations_insert_participant ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = ANY (participants));

DROP POLICY IF EXISTS conversations_update_participant ON public.conversations;
CREATE POLICY conversations_update_participant ON public.conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() = ANY (participants))
  WITH CHECK (auth.uid() = ANY (participants));

DROP POLICY IF EXISTS messages_select_participant ON public.messages;
CREATE POLICY messages_select_participant ON public.messages
  FOR SELECT TO authenticated
  USING (
    conversation_id IN (SELECT id FROM public.conversations WHERE auth.uid() = ANY (participants))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS messages_insert_participant ON public.messages;
CREATE POLICY messages_insert_participant ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (SELECT id FROM public.conversations WHERE auth.uid() = ANY (participants))
  );
