# Corrigir links de convite de entregadores

## O que está acontecendo

Testei o fluxo do jeito que o entregador vê: abrindo o link de convite sem estar logado.

- O domínio `entregador.mt24horasexpress.com/invite/<token>` responde normalmente (200), então o link em si não está quebrado.
- O que falha é a **validação do token**: sem login, o banco recusa a consulta.
  - A função `get_invitation_by_token` retorna `permission denied` para visitantes não autenticados.
  - A leitura direta da tabela de convites também retorna `permission denied` (a regra de acesso chama a função `has_role`, que igualmente não é liberada para visitantes).

Resultado: o app do entregador não consegue confirmar que o convite existe e exibe "link inválido / convite não encontrado" para qualquer link, mesmo válido e dentro do prazo.

Isso é efeito colateral do endurecimento de segurança feito nas rodadas anteriores: o acesso anônimo foi fechado em bloco, incluindo o único caminho que precisa ser público (validar um convite pelo token secreto).

## Correção proposta

1. Liberar a validação de convite por token para visitantes não autenticados, de forma controlada:
   - Recriar `get_invitation_by_token` como função com privilégio próprio (não depende das regras da tabela), retornando **apenas** os campos necessários para a tela de cadastro: função (entregador/lojista), situação e data de expiração — sem e-mail, sem quem convidou, sem outros convites.
   - A função só devolve algo se o token bater exatamente e o convite estiver pendente e não expirado.
   - Conceder execução dessa função ao papel anônimo. A tabela de convites continua fechada para leitura direta.
2. Ajustar a validação no painel/app para usar esse retorno enxuto.
3. Segundo ponto encontrado, que também derruba o cadastro mesmo depois da validação: o painel grava o convite com um e-mail fictício (`convite_<token>@...`) e a função de aceite exige que o e-mail digitado seja igual ao do convite. Vou remover essa exigência de igualdade quando o convite for do tipo "link aberto", mantendo-a quando um e-mail real foi informado.

## Detalhes técnicos

- Migração: `CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token text) RETURNS TABLE(role app_role, status invitation_status, expires_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public`, filtrando `token = _token AND status = 'pending' AND expires_at > now()`; `REVOKE ALL ... FROM public` + `GRANT EXECUTE TO anon, authenticated`. Nenhuma política nova de `SELECT` na tabela `invitations`.
- `src/services/users.ts` → `validateInvitation` passa a ler a primeira linha do retorno tabular e a mensagem de erro distingue "não encontrado" de "expirado".
- `supabase/functions/accept-invitation/index.ts` → checagem de e-mail só quando `invitation.email` não é um placeholder de convite por link.
- `src/lib/invites.ts` fica como está: os domínios respondem e o formato `/invite/<token>` está correto.

## Verificação

Após aplicar, testo o RPC como visitante anônimo com um token real e confirmo que retorna o convite; depois abro um link de convite gerado no painel e confirmo que a tela de cadastro carrega em vez de "link inválido".
