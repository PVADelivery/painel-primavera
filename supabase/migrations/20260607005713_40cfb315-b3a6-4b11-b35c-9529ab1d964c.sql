
-- 1) Lock down SECURITY DEFINER function: revoke from anon/public, allow authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 2) Orders: allow companies (and admins) to insert/update orders for their own company
CREATE POLICY "Companies create orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = orders.company_id AND c.user_id = auth.uid())
);

CREATE POLICY "Companies update own orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = orders.company_id AND c.user_id = auth.uid())
);

-- 3) Reviews: allow company owners to read reviews on deliveries they own
CREATE POLICY "Reviews readable by company owner"
ON public.reviews
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.deliveries d
    JOIN public.companies c ON c.id = d.company_id
    WHERE d.id = reviews.delivery_id AND c.user_id = auth.uid()
  )
);

-- 4) Storage policies on 'occurrences' bucket: add SELECT for owning driver+admin, DELETE for admin/owner
CREATE POLICY "occurrences owner or admin select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'occurrences'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "occurrences owner or admin delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'occurrences'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);
