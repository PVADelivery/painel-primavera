# Biblioteca de Bugs Conhecidos (MT 24horas express)

Este documento serve como um repositório central para documentar os erros, problemas de arquitetura e bugs que já foram resolvidos durante o desenvolvimento do painel administrativo e do ecossistema do MT 24horas express. 

Antes de tentar solucionar um novo problema, consulte este arquivo para verificar se a correção já não foi implementada anteriormente.

## 🐛 1. Erro de Encoding (Caracteres Especiais Quebrados) ao Copiar Arquivos
**Sintoma:** Ao migrar arquivos ou copiar funções de outros repositórios, palavras com acentuação aparecem quebradas no código (ex: `Ã¡` ao invés de `á`, `Ã§` ao invés de `ç`). 
**Causa:** A cópia de arquivos entre ambientes (ou pelo console) não preservou a codificação `UTF-8`.
**Solução:** Substituição global no código dos caracteres Latin-1 corrompidos pelas suas respectivas versões em UTF-8. 
**Script de Correção (PowerShell):**
```powershell
$replacements = @{ "Ã¡"="á"; "Ã£"="ã"; "Ã§"="ç"; "Ã©"="é"; "Ãª"="ê"; "Ã­"="í"; "Ã³"="ó"; "Ãµ"="õ"; "Ãº"="ú"; "Ã¢"="â" }
Get-ChildItem -Path "src" -Recurse -File -Include *.ts,*.tsx | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $modified = $false
    foreach ($key in $replacements.Keys) {
        if ($content.Contains($key)) {
            $content = $content.Replace($key, $replacements[$key])
            $modified = $true
        }
    }
    if ($modified) { Set-Content $_.FullName $content -Encoding UTF8 }
}
```

## 🐛 2. Tabela `invitations` não encontrada (Schema Cache do Supabase)
**Sintoma:** Ao tentar criar um convite, a interface retorna `Could not find the table 'public.invitations' in the schema cache`.
**Causa:** A tabela não existia no novo banco de dados Supabase da franquia atual. Ao copiarmos as interfaces do painel anterior, o banco atual não estava preparado para recebê-las.
**Solução:** Rodar o SQL de migração para criar a tabela `invitations` contendo o enum `invitation_status` e a função RPC `get_invitation_by_token`.

## 🐛 3. Links de Convite Direcionando para localhost ou URLs Antigas
**Sintoma:** A função de "Gerar Convite" estava cuspindo o link base como `localhost:5173` ou com os domínios do sistema anterior (É Pra Já).
**Causa:** As constantes do `baseUrl` no arquivo `GenerateInviteDialog.tsx` estavam estáticas apontando para URLs obsoletas ou de desenvolvimento.
**Solução:** Corrigido o arquivo `GenerateInviteDialog.tsx` para injetar os links corretos de produção: `https://entregador.primaveradelivery.com/invite` e `https://lojista.primaveradelivery.com/invite`.

## 🐛 4. Ausência de Menus Administrativos na Lovable
**Sintoma:** Alterações nos botões laterais (AdminSidebar) e novas páginas (Vendas Lojas, Bases) foram concluídas, mas não refletiam na Lovable.
**Causa:** O ambiente de edição (AI IDE) trabalhava no file system local sem ter feito o Push (Commit) para a branch `main` do GitHub conectada ao serviço Lovable.
**Solução:** A interface virtual do Lovable lê direto do Github. Sempre que terminarmos blocos de atualizações nos códigos-fontes locais, precisamos rodar `git add .`, `git commit` e `git push` para que a alteração suba para produção/preview.
