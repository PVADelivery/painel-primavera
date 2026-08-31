-- =========================================================================
-- MIGRATION: Permitir que administradores excluam empresas com exclusão em cascata
-- Resolve o erro: status 409 (Foreign Key Constraint Violation)
-- =========================================================================

-- 1. Função RPC definitiva e segura para exclusão de empresa em cascata pelo Admin
CREATE OR REPLACE FUNCTION public.delete_company_cascade(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean := false;
BEGIN
  -- 1. Verificar privilégios de Admin
  BEGIN
    v_is_admin := public.is_admin_safe();
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;

  IF NOT v_is_admin THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    ) INTO v_is_admin;
  END IF;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas administradores podem excluir empresas.');
  END IF;

  -- 2. Excluir itens de pedidos e pedidos
  BEGIN
    DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE company_id = p_company_id);
  EXCEPTION WHEN OTHERS THEN END;

  BEGIN
    DELETE FROM public.orders WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  -- 3. Excluir entregas e solicitações
  BEGIN
    DELETE FROM public.deliveries WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  BEGIN
    DELETE FROM public.delivery_requests WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  -- 4. Excluir produtos, complementos, categorias e opções
  BEGIN
    DELETE FROM public.product_option_items WHERE product_id IN (SELECT id FROM public.products WHERE company_id = p_company_id);
  EXCEPTION WHEN OTHERS THEN END;

  BEGIN
    DELETE FROM public.product_options WHERE product_id IN (SELECT id FROM public.products WHERE company_id = p_company_id);
  EXCEPTION WHEN OTHERS THEN END;

  BEGIN
    DELETE FROM public.products WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  BEGIN
    DELETE FROM public.categories WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  -- 5. Excluir cupons vinculados
  BEGIN
    DELETE FROM public.coupon_companies WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  BEGIN
    DELETE FROM public.coupons WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  -- 6. Excluir créditos e transações de créditos
  BEGIN
    DELETE FROM public.merchant_credit_payouts WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  BEGIN
    DELETE FROM public.store_credit_transactions WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  BEGIN
    DELETE FROM public.store_credits WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  -- 7. Excluir faturas e financeiro
  BEGIN
    DELETE FROM public.store_invoice_items WHERE invoice_id IN (SELECT id FROM public.store_invoices WHERE company_id = p_company_id);
  EXCEPTION WHEN OTHERS THEN END;

  BEGIN
    DELETE FROM public.store_invoices WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  BEGIN
    DELETE FROM public.merchant_invoices WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  BEGIN
    DELETE FROM public.cash_flow_entries WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  -- 8. Excluir integrações (iFood, etc.)
  BEGIN
    DELETE FROM public.ifood_merchants WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  BEGIN
    DELETE FROM public.ifood_polling_logs WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  BEGIN
    DELETE FROM public.ifood_sync_logs WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  -- 9. Excluir permissões, convites e banners
  BEGIN
    DELETE FROM public.company_users WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  BEGIN
    DELETE FROM public.user_roles WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  BEGIN
    DELETE FROM public.invitations WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  BEGIN
    DELETE FROM public.banners WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  BEGIN
    DELETE FROM public.notifications WHERE company_id = p_company_id;
  EXCEPTION WHEN OTHERS THEN END;

  -- 10. Excluir a empresa
  DELETE FROM public.companies WHERE id = p_company_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_company_cascade(uuid) TO authenticated, anon, public;
NOTIFY pgrst, 'reload schema';
