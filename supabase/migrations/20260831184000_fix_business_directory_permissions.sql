-- =========================================================================
-- MIGRATION: Liberar acesso completo para business_directory (PPP)
-- =========================================================================

GRANT ALL ON public.business_directory TO authenticated, anon, service_role;
ALTER TABLE public.business_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_directory_public_read" ON public.business_directory;
DROP POLICY IF EXISTS "business_directory_authenticated_read" ON public.business_directory;
DROP POLICY IF EXISTS "business_directory_showcase_read" ON public.business_directory;
DROP POLICY IF EXISTS "business_directory_admin_all" ON public.business_directory;
DROP POLICY IF EXISTS "business_directory_all" ON public.business_directory;
DROP POLICY IF EXISTS "business_directory_full_access" ON public.business_directory;

CREATE POLICY "business_directory_full_access" ON public.business_directory
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
