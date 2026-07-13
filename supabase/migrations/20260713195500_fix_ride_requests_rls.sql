-- Adicionar permissão de INSERT para a tabela ride_requests
CREATE POLICY "Enable insert for authenticated users" 
ON public.ride_requests 
FOR INSERT TO authenticated 
WITH CHECK (true);
