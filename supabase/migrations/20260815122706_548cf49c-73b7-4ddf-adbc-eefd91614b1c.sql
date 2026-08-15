-- 1. system_error_logs: enable RLS
ALTER TABLE public.system_error_logs ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.system_error_logs TO anon, authenticated;
GRANT SELECT, DELETE ON public.system_error_logs TO authenticated;
GRANT ALL ON public.system_error_logs TO service_role;

DROP POLICY IF EXISTS "system_error_logs_insert_any" ON public.system_error_logs;
CREATE POLICY "system_error_logs_insert_any" ON public.system_error_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "system_error_logs_admin_read" ON public.system_error_logs;
CREATE POLICY "system_error_logs_admin_read" ON public.system_error_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "system_error_logs_admin_delete" ON public.system_error_logs;
CREATE POLICY "system_error_logs_admin_delete" ON public.system_error_logs
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Security definer view -> security invoker
ALTER VIEW public.view_financial_summary SET (security_invoker = true);
REVOKE ALL ON public.view_financial_summary FROM anon;

-- 3. Remove anon full-row read of companies (public storefront must use get_public_companies())
DROP POLICY IF EXISTS "Vitrine pública de lojas ativas" ON public.companies;
REVOKE SELECT ON public.companies FROM anon;

-- 4. Prevent role escalation on profile self-insert
DROP POLICY IF EXISTS "Profiles_Final_Insert" ON public.profiles;
CREATE POLICY "Profiles_Final_Insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (role IS NULL OR role = 'customer')
    AND status = 'pending'::profile_status
  );

-- 5. merchant_invoices admin check via user_roles instead of profiles.role
DROP POLICY IF EXISTS "Admins can manage merchant invoices" ON public.merchant_invoices;
CREATE POLICY "Admins can manage merchant invoices" ON public.merchant_invoices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));