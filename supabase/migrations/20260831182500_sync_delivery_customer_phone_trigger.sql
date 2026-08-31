-- =========================================================================
-- MIGRATION: Trigger para auto-sincronizar telefone do cliente em deliveries
-- =========================================================================

CREATE OR REPLACE FUNCTION public.sync_delivery_customer_info()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_phone TEXT;
  v_name TEXT;
BEGIN
  IF (NEW.customer_phone IS NULL OR NEW.customer_phone = '') AND NEW.order_id IS NOT NULL THEN
    SELECT COALESCE(p.phone, c.phone, o.customer_phone),
           COALESCE(p.full_name, c.name, o.customer_name)
      INTO v_phone, v_name
      FROM public.orders o
      LEFT JOIN public.profiles p ON p.id = o.user_id
      LEFT JOIN public.customers c ON c.id = o.customer_id
     WHERE o.id = NEW.order_id;

    IF v_phone IS NOT NULL AND v_phone <> '' THEN
      NEW.customer_phone := v_phone;
    END IF;
    IF v_name IS NOT NULL AND v_name <> '' AND (NEW.customer_name IS NULL OR NEW.customer_name = 'Cliente') THEN
      NEW.customer_name := v_name;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_delivery_customer_info ON public.deliveries;
CREATE TRIGGER trg_sync_delivery_customer_info
  BEFORE INSERT OR UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_delivery_customer_info();

NOTIFY pgrst, 'reload schema';
