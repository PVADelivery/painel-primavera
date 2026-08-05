ALTER TABLE public.company_credits
  ADD COLUMN IF NOT EXISTS total_purchased numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_consumed numeric(12,2) NOT NULL DEFAULT 0;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_credits TO authenticated;
GRANT ALL ON public.company_credits TO service_role;

DROP POLICY IF EXISTS "Admins manage company credits" ON public.company_credits;
CREATE POLICY "Admins manage company credits" ON public.company_credits
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Company owner reads own credits" ON public.company_credits;
CREATE POLICY "Company owner reads own credits" ON public.company_credits
  FOR SELECT TO authenticated
  USING (public.user_owns_company(company_id));

DROP TRIGGER IF EXISTS update_company_credits_updated_at ON public.company_credits;
CREATE TRIGGER update_company_credits_updated_at
  BEFORE UPDATE ON public.company_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.company_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'purchase',
  amount numeric(12,2) NOT NULL,
  balance_after numeric(12,2),
  description text,
  payment_method text,
  reference_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_credit_tx_company_idx
  ON public.company_credit_transactions(company_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_credit_transactions TO authenticated;
GRANT ALL ON public.company_credit_transactions TO service_role;
ALTER TABLE public.company_credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage credit transactions" ON public.company_credit_transactions;
CREATE POLICY "Admins manage credit transactions" ON public.company_credit_transactions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Company owner reads own credit transactions" ON public.company_credit_transactions;
CREATE POLICY "Company owner reads own credit transactions" ON public.company_credit_transactions
  FOR SELECT TO authenticated
  USING (public.user_owns_company(company_id));

CREATE OR REPLACE FUNCTION public.add_company_credits(
  _company_id uuid,
  _amount numeric,
  _description text DEFAULT NULL,
  _payment_method text DEFAULT NULL,
  _type text DEFAULT 'purchase'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  IF _amount IS NULL OR _amount = 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  INSERT INTO public.company_credits (company_id, balance)
  VALUES (_company_id, 0)
  ON CONFLICT (company_id) DO NOTHING;

  UPDATE public.company_credits
     SET balance = balance + _amount,
         total_purchased = total_purchased + GREATEST(_amount, 0),
         total_consumed = total_consumed + GREATEST(-_amount, 0)
   WHERE company_id = _company_id
  RETURNING balance INTO v_balance;

  IF v_balance < 0 THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  INSERT INTO public.company_credit_transactions
    (company_id, type, amount, balance_after, description, payment_method, created_by)
  VALUES (_company_id, COALESCE(_type, 'purchase'), _amount, v_balance, _description, _payment_method, auth.uid());

  RETURN jsonb_build_object('success', true, 'balance', v_balance);
END;
$$;