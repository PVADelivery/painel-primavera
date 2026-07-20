
-- Remove overly permissive "allow_all" and auth_all policies
DROP POLICY IF EXISTS allow_all ON public.deliveries;
DROP POLICY IF EXISTS allow_all ON public.companies;
DROP POLICY IF EXISTS allow_all ON public.regions;
DROP POLICY IF EXISTS allow_all ON public.customers;
DROP POLICY IF EXISTS allow_all ON public.addresses;
DROP POLICY IF EXISTS pricing_tables_auth_all ON public.pricing_tables;
DROP POLICY IF EXISTS pricing_rules_auth_all ON public.pricing_rules;

-- Ensure admin management for pricing tables/rules (they had only the permissive policy)
CREATE POLICY "Admins manage pricing_tables" ON public.pricing_tables
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage pricing_rules" ON public.pricing_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Ensure admin can manage regions (in case only the permissive policy existed for writes)
CREATE POLICY "Admins manage regions" ON public.regions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
