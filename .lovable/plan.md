# Regiões por planilha (substituir o mapa)

Trocar a tela de Regiões do painel Admin — hoje baseada em mapa/desenho de polígonos — por uma planilha editável de regiões e bairros, igual ao fluxo usado no painel do lojista, mas com poder total de edição para o admin.

## O que o admin poderá fazer

- Ver as 5 regiões em formato de lista/planilha, com número, nome, valor da entrega e quantidade de bairros.
- Editar o nome e o valor (R$) de cada região direto na linha.
- Expandir a região e ver todos os bairros em colunas, como no painel do lojista.
- Adicionar bairro, renomear bairro e remover bairro em qualquer região.
- Mover um bairro de uma região para outra.
- Criar nova região e excluir região (com aviso quando houver bairros vinculados).
- Ativar/desativar região (região inativa não aparece para o lojista).
- Busca por bairro (mostra em qual região ele está e qual o valor).

## Dados iniciais

As 3 regiões atuais desenhadas no mapa serão removidas e substituídas por 5 regiões, já preenchidas com os bairros exatamente como estão no painel do lojista:

| # | Região | Valor | Bairros |
|---|--------|-------|---------|
| 1 | Região 1 | R$ 8,00 | (sem bairros cadastrados) |
| 2 | Centro - PVA 1 / JD Riva 1/2/3/4 | R$ 10,00 | 36 bairros (Atlântico Sul … Vila Popular) |
| 3 | Região 3 | R$ 12,00 | 15 bairros (Buritis 1/2/3/4/5 … Tuiuiú) |
| 4 | Região 4 | R$ 15,00 | 8 bairros (Até Royal … Santa Felicidade) |
| 5 | Região 5 | R$ 20,00 | (sem bairros cadastrados) |

Os bairros serão inseridos exatamente com os nomes da lista enviada.

## Remoção do mapa

- A aba "Regiões" passa a abrir a planilha.
- Todo o código de desenho no mapa (modo pontos / modo lápis, polígonos, rótulos de preço no mapa) sai da tela de Regiões.
- O mapa de Rastreio/Dashboard continua funcionando; ele apenas deixa de desenhar os polígonos de região.

## Detalhes técnicos

- Migração: nova tabela `public.region_neighborhoods` (`region_id` FK → `regions`, `name`, `sort_order`, timestamps) com GRANTs (`SELECT` para `anon` e `authenticated`, escrita só para admin via `has_role`), RLS ligada e políticas: leitura pública das regiões ativas, escrita apenas admin. Índice único por (`region_id`, `name`).
- Migração também: adiciona `sort_order`/`number` em `regions` para a ordem 1..5, apaga as 3 regiões atuais (verificando dependências em `deliveries.region_id`/`companies.region_id` — se houver referências, as regiões antigas são desativadas e desvinculadas em vez de apagadas para não quebrar históricos), e faz o INSERT literal das 5 regiões + todos os bairros.
- `src/services/regions.ts`: adiciona `fetchRegionsWithNeighborhoods`, hooks `useRegionNeighborhoods`, `useCreateNeighborhood`, `useUpdateNeighborhood`, `useDeleteNeighborhood`, `useMoveNeighborhood`, mantendo os hooks existentes usados por outras telas.
- `src/routes/admin/regions.tsx`: reescrito como planilha (sem maplibre). Componentes novos em `src/components/admin/regions/`: `RegionSheetRow.tsx`, `NeighborhoodGrid.tsx`, `RegionFormDialog.tsx`.
- `src/components/admin/MapView.tsx`: remove a renderização de polígonos/rótulos de regiões e o popup de edição de preço; mantém marcadores de entregadores e empresas.
- Estilo alinhado ao painel: cartões escuros, chips de bairro, botão amarelo (primary) de ação, tokens semânticos existentes.
