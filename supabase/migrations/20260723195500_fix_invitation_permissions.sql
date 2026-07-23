-- Correção de Permissão para Links de Convite (Lojistas e Entregadores)
-- Libera a execução da função get_invitation_by_token para usuários anônimos (anon) e autenticados (authenticated)

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token TO anon, authenticated, service_role;

DO $$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated, service_role';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) TO anon, authenticated, service_role';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
