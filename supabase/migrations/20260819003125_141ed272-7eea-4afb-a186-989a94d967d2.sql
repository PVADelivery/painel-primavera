DROP POLICY IF EXISTS "Permitir leitura publica de bairros" ON public.region_neighborhoods;

DROP POLICY IF EXISTS "system_error_logs_insert_any" ON public.system_error_logs;
CREATE POLICY "system_error_logs_insert_anon" ON public.system_error_logs
  FOR INSERT TO anon WITH CHECK (user_id IS NULL);

ALTER FUNCTION public.unassign_delivery_driver(uuid) SET search_path = public;
ALTER FUNCTION public.update_delivery_status_safe(uuid, text) SET search_path = public;