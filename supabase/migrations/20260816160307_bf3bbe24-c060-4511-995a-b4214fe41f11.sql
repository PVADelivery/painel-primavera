-- 1) companies: remove public/anon full-row read (leaked email, document, zip_code)
DROP POLICY IF EXISTS "companies_public_read" ON public.companies;
REVOKE SELECT ON public.companies FROM anon;
GRANT EXECUTE ON FUNCTION public.get_public_companies() TO anon, authenticated;

-- 2) coupons: remove public full-row read
DROP POLICY IF EXISTS "coupons_select_public" ON public.coupons;

CREATE POLICY "coupons_admin_all" ON public.coupons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

REVOKE SELECT ON public.coupons FROM anon;

-- Safe server-side validation returning only what the client needs
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code text, p_company_id uuid, p_subtotal numeric)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c public.coupons;
  v_discount numeric := 0;
  v_scoped boolean;
BEGIN
  SELECT * INTO c
    FROM public.coupons
   WHERE upper(code) = upper(trim(p_code))
     AND active = true
   LIMIT 1;

  IF c.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Cupom inválido');
  END IF;

  IF c.expiration_date IS NOT NULL AND c.expiration_date < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Cupom expirado');
  END IF;

  IF c.usage_limit IS NOT NULL AND COALESCE(c.used_count, 0) >= c.usage_limit THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Cupom esgotado');
  END IF;

  IF c.min_purchase IS NOT NULL AND p_subtotal < c.min_purchase THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Valor mínimo não atingido');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.coupon_companies cc WHERE cc.coupon_id = c.id)
    INTO v_scoped;

  IF v_scoped AND (p_company_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.coupon_companies cc
         WHERE cc.coupon_id = c.id AND cc.company_id = p_company_id)) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Cupom não válido para esta loja');
  END IF;

  IF c.type = 'percentage' THEN
    v_discount := round((p_subtotal * c.value / 100.0)::numeric, 2);
    IF c.max_discount IS NOT NULL AND v_discount > c.max_discount THEN
      v_discount := c.max_discount;
    END IF;
  ELSE
    v_discount := LEAST(c.value, p_subtotal);
  END IF;

  RETURN jsonb_build_object('valid', true, 'discount', v_discount, 'coupon_id', c.id, 'code', c.code);
END;
$$;

REVOKE ALL ON FUNCTION public.validate_coupon(text, uuid, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, uuid, numeric) TO anon, authenticated;