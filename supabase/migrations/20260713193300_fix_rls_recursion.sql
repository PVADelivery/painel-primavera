-- 1. Create a SECURITY DEFINER function to fetch the user's company IDs
-- This prevents the RLS on companies from infinitely recursing with deliveries.
CREATE OR REPLACE FUNCTION public.get_user_company_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.companies WHERE user_id = uid;
$$;

-- 2. Update the deliveries policies to use this function instead of querying companies directly
DROP POLICY IF EXISTS deliveries_select_scoped ON public.deliveries;
DROP POLICY IF EXISTS deliveries_insert_scoped ON public.deliveries;
DROP POLICY IF EXISTS deliveries_update_scoped ON public.deliveries;

CREATE POLICY deliveries_select_scoped ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR company_id IN (SELECT public.get_user_company_ids(auth.uid()))
    OR (driver_id IS NOT NULL AND driver_id = public.get_driver_id(auth.uid()))
    OR (driver_id IS NULL AND status IN ('pending'::delivery_status, 'broadcasted'::delivery_status)
        AND EXISTS (SELECT 1 FROM public.delivery_drivers dd WHERE dd.user_id = auth.uid() AND dd.status = 'active'))
  );

CREATE POLICY deliveries_insert_scoped ON public.deliveries
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR company_id IN (SELECT public.get_user_company_ids(auth.uid()))
  );

CREATE POLICY deliveries_update_scoped ON public.deliveries
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR company_id IN (SELECT public.get_user_company_ids(auth.uid()))
    OR (driver_id IS NOT NULL AND driver_id = public.get_driver_id(auth.uid()))
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR company_id IN (SELECT public.get_user_company_ids(auth.uid()))
    OR (driver_id IS NOT NULL AND driver_id = public.get_driver_id(auth.uid()))
  );
