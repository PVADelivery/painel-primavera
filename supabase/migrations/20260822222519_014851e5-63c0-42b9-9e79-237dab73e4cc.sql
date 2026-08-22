DROP POLICY IF EXISTS "drivers_insert_own" ON public.delivery_drivers;

DROP POLICY IF EXISTS "pricing_tables_authenticated_read" ON public.pricing_tables;
CREATE POLICY "pricing_tables_scoped_read" ON public.pricing_tables
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.user_id = auth.uid() AND c.pricing_table_id = pricing_tables.id
  )
);

DROP POLICY IF EXISTS "pricing_rules_authenticated_read" ON public.pricing_rules;
CREATE POLICY "pricing_rules_scoped_read" ON public.pricing_rules
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.user_id = auth.uid() AND c.pricing_table_id = pricing_rules.pricing_table_id
  )
);