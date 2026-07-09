-- Adiciona coluna de tipo de veículo na tabela de entregas se não existir
ALTER TABLE public.deliveries 
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'moto'
  CHECK (vehicle_type IN ('moto', 'carro', 'carro_aberto'));
