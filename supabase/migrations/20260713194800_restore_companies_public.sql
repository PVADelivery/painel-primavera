-- 1. Restore public read access to the companies table so the Marketplace can list stores
DROP POLICY IF EXISTS "Companies readable by involved parties" ON public.companies;

CREATE POLICY "Companies are publicly readable" ON public.companies
  FOR SELECT
  USING (true);

-- 2. Restore public read access to business_directory view/table as well
DROP POLICY IF EXISTS business_directory_authenticated_read ON public.business_directory;

CREATE POLICY "business_directory_public_read" ON public.business_directory
  FOR SELECT
  USING (true);
