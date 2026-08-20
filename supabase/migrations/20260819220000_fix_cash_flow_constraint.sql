-- ============================================================================
-- SCRIPT DE CORREÇÃO: CONSTRAINT DE TYPE DA TABELA PLATFORM_CASH_FLOW
-- ============================================================================

ALTER TABLE public.platform_cash_flow DROP CONSTRAINT IF EXISTS platform_cash_flow_type_check;

ALTER TABLE public.platform_cash_flow ADD CONSTRAINT platform_cash_flow_type_check 
  CHECK (type IN ('income', 'expense', 'receivable', 'payable', 'entrada', 'saida', 'receita', 'despesa', 'direito', 'obrigacao'));
