-- 1. accept_delivery_batch: require auth + driver ownership
CREATE OR REPLACE FUNCTION public.accept_delivery_batch(p_batch_id uuid, p_driver_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INT := 0;
  v_now TIMESTAMP WITH TIME ZONE := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: autenticação necessária.';
  END IF;

  IF p_batch_id IS NULL THEN
    RAISE EXCEPTION 'ID do lote não informado.';
  END IF;

  IF p_driver_id IS NULL THEN
    RAISE EXCEPTION 'ID do entregador não informado.';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.get_driver_id(auth.uid()) = p_driver_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: você não pode aceitar entregas para outro entregador.';
  END IF;

  UPDATE public.deliveries
     SET status = 'accepted'::public.delivery_status,
         driver_id = p_driver_id,
         accepted_at = v_now,
         updated_at = v_now
   WHERE batch_id = p_batch_id
     AND (status = 'pending'::public.delivery_status OR status = 'broadcasted'::public.delivery_status);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Este lote não está mais disponível para aceite.';
  END IF;

  RETURN jsonb_build_object('success', true, 'accepted_count', v_count, 'batch_id', p_batch_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_delivery_batch(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.accept_delivery_batch(uuid, uuid) TO authenticated;

-- 2. batch_create_delivery_requests: require company ownership or admin
CREATE OR REPLACE FUNCTION public.batch_create_delivery_requests(p_company_id uuid, p_deliveries jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_delivery JSONB;
  v_count INT := 0;
  v_company_name TEXT;
  v_pickup_address TEXT;
  v_created_ids UUID[] := '{}';
  v_short_ids TEXT[] := '{}';
  v_batch_id UUID;
  v_new_id UUID;
  v_short_id TEXT;
  v_fee NUMERIC(10,2);
  v_val NUMERIC(10,2);
  v_total_fee NUMERIC(10,2) := 0.00;
  v_balance NUMERIC(10,2);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: autenticação necessária.';
  END IF;

  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'ID da empresa não informado.';
  END IF;

  IF NOT (public.user_owns_company(p_company_id)
          OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'FORBIDDEN: você não tem permissão para criar entregas para esta empresa.';
  END IF;

  FOR v_delivery IN SELECT * FROM jsonb_array_elements(p_deliveries)
  LOOP
    v_total_fee := v_total_fee + COALESCE((v_delivery->>'value')::numeric, (v_delivery->>'delivery_fee')::numeric, 0.00);
  END LOOP;

  INSERT INTO public.company_credits (company_id, balance)
  VALUES (p_company_id, 0.00)
  ON CONFLICT (company_id) DO NOTHING;

  SELECT balance INTO v_balance
    FROM public.company_credits
   WHERE company_id = p_company_id
   FOR UPDATE;

  IF v_balance < v_total_fee THEN
    RAISE EXCEPTION 'Saldo de créditos insuficiente (Saldo: R$ %, Necessário: R$ %).', v_balance, v_total_fee;
  END IF;

  SELECT name, address INTO v_company_name, v_pickup_address
    FROM public.companies
   WHERE id = p_company_id;

  v_batch_id := gen_random_uuid();

  FOR v_delivery IN SELECT * FROM jsonb_array_elements(p_deliveries)
  LOOP
    v_new_id := gen_random_uuid();
    v_short_id := '#' || upper(substring(md5(v_new_id::text || clock_timestamp()::text) from 1 for 4));
    v_fee := COALESCE((v_delivery->>'value')::numeric, (v_delivery->>'delivery_fee')::numeric, 0.00);
    v_val := v_fee;

    INSERT INTO public.deliveries (
      id, short_id, company_id, company_name, pickup_address,
      customer_name, customer_phone, address, customer_neighborhood, notes,
      value, delivery_fee, payment_method, order_value, change_for,
      vehicle_type, region_id, batch_id, status, created_at, updated_at
    ) VALUES (
      v_new_id, v_short_id, p_company_id,
      COALESCE(v_company_name, v_delivery->>'company_name', 'Loja'),
      COALESCE(v_pickup_address, v_delivery->>'pickup_address', 'Loja'),
      COALESCE(v_delivery->>'customer_name', 'Cliente'),
      v_delivery->>'customer_phone',
      COALESCE(v_delivery->>'address', 'Endereço não informado'),
      v_delivery->>'customer_neighborhood', v_delivery->>'notes',
      v_val, v_fee,
      COALESCE(v_delivery->>'payment_method', 'dinheiro'),
      COALESCE((v_delivery->>'order_value')::numeric, 0.00),
      COALESCE((v_delivery->>'change_for')::numeric, 0.00),
      COALESCE(v_delivery->>'vehicle_type', 'moto'),
      (v_delivery->>'region_id')::uuid,
      v_batch_id, 'pending'::public.delivery_status, now(), now()
    );

    v_count := v_count + 1;
    v_created_ids := array_append(v_created_ids, v_new_id);
    v_short_ids := array_append(v_short_ids, v_short_id);
  END LOOP;

  UPDATE public.company_credits
     SET balance = balance - v_total_fee
   WHERE company_id = p_company_id
  RETURNING balance INTO v_balance;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_transactions') THEN
    INSERT INTO public.credit_transactions (company_id, type, amount, balance_after, description, created_at)
    VALUES (p_company_id, 'debit', -v_total_fee, v_balance, 'Lote com ' || v_count || ' entregas criadas', now());
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'count', v_count,
    'batch_id', v_batch_id,
    'created_ids', to_jsonb(v_created_ids),
    'short_ids', to_jsonb(v_short_ids),
    'balance_after', v_balance
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.batch_create_delivery_requests(uuid, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.batch_create_delivery_requests(uuid, jsonb) TO authenticated;

-- 3. set_company_pricing_table: owner or admin only
CREATE OR REPLACE FUNCTION public.set_company_pricing_table(p_company_id uuid, p_pricing_table_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INT := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: autenticação necessária.';
  END IF;

  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'ID da empresa não informado.';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.user_owns_company(p_company_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN: você não tem permissão para alterar a tabela de preços desta empresa.';
  END IF;

  UPDATE public.companies
     SET pricing_table_id = p_pricing_table_id,
         updated_at = now()
   WHERE id = p_company_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Empresa não encontrada para atualização.';
  END IF;

  RETURN jsonb_build_object('success', true, 'company_id', p_company_id, 'pricing_table_id', p_pricing_table_id, 'updated_rows', v_count);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_company_pricing_table(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_company_pricing_table(uuid, uuid) TO authenticated;

-- 4. get_company_pricing_rules: owner or admin only
CREATE OR REPLACE FUNCTION public.get_company_pricing_rules(p_company_id uuid)
 RETURNS TABLE(pricing_table_id uuid, origin_region_id uuid, destination_region_id uuid, base_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_table_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: autenticação necessária.';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.user_owns_company(p_company_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN: você não tem permissão para consultar os preços desta empresa.';
  END IF;

  SELECT c.pricing_table_id INTO v_table_id
    FROM public.companies c
   WHERE c.id = p_company_id;

  IF v_table_id IS NULL THEN
    SELECT pt.id INTO v_table_id
      FROM public.pricing_tables pt
     WHERE pt.is_default = true
     LIMIT 1;
  END IF;

  IF v_table_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT pr.pricing_table_id, pr.origin_region_id, pr.destination_region_id, pr.base_value
    FROM public.pricing_rules pr
   WHERE pr.pricing_table_id = v_table_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_company_pricing_rules(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_company_pricing_rules(uuid) TO authenticated;