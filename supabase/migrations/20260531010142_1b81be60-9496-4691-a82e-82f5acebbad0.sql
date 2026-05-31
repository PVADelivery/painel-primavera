
-- 1) Lojista cria deliveries da própria empresa
CREATE POLICY "company creates own deliveries"
ON public.deliveries
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = deliveries.company_id AND c.user_id = auth.uid()
  )
);

-- 2) Lojista atualiza deliveries da própria empresa (cancelar etc.)
CREATE POLICY "company updates own deliveries"
ON public.deliveries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = deliveries.company_id AND c.user_id = auth.uid()
  )
);

-- 3) Entregador registra ocorrências das suas corridas
CREATE POLICY "driver creates own occurrences"
ON public.occurrences
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.delivery_drivers d
    WHERE d.id = occurrences.driver_id AND d.user_id = auth.uid()
  )
);

-- 4) Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('occurrences', 'occurrences', false)
ON CONFLICT (id) DO NOTHING;

-- 5) Policies para avatars (público para leitura, dono escreve)
CREATE POLICY "avatars public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "avatars owner insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "avatars owner update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "avatars owner delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 6) Policies para occurrences (privado: dono + admin)
CREATE POLICY "occurrences owner read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'occurrences' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "occurrences owner insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'occurrences' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "occurrences owner update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'occurrences' AND auth.uid()::text = (storage.foldername(name))[1]
);
