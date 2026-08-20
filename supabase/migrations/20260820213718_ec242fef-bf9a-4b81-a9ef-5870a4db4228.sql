DROP POLICY IF EXISTS "pricing_rules_public_read" ON public.pricing_rules;
DROP POLICY IF EXISTS "Permitir leitura de regras de preço para todos" ON public.pricing_rules;
DROP POLICY IF EXISTS "pricing_rules_select_all" ON public.pricing_rules;
DROP POLICY IF EXISTS "pricing_tables_public_read" ON public.pricing_tables;
DROP POLICY IF EXISTS "Permitir leitura de tabelas de preço para todos" ON public.pricing_tables;
DROP POLICY IF EXISTS "pricing_tables_select_all" ON public.pricing_tables;

CREATE POLICY "pricing_rules_authenticated_read" ON public.pricing_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pricing_tables_authenticated_read" ON public.pricing_tables
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON public.pricing_rules FROM anon;
REVOKE ALL ON public.pricing_tables FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_tables TO authenticated;
GRANT ALL ON public.pricing_rules TO service_role;
GRANT ALL ON public.pricing_tables TO service_role;