# Checkpoint 222 — Filmes, Séries e Detalhes em TV no formato do Roku

## Base

- Versão de desenvolvimento: **2.17.16**.
- Checkpoint anterior: **221**.
- Referência: ELVANOQ Play Roku **0.1.88** (`BrowseView`, `DetailView`, `MetadataService`, `AppShell.loadMetadata`).

## Paridade

| Roku 0.1.88 | Android TV |
| --- | --- |
| Painel de categorias (400 px) com contagem; 1ª linha "Buscar título ou ator" | Igual, com Minha Lista e Todas no topo |
| Grade 6 × 2 de pôsteres com rótulo da categoria | Grade de 6 colunas com rolagem contínua |
| Troca de categoria após o controle parar (350 ms) | Igual (350 ms) |
| Rodapé com título e meta do item focado | Igual, com ano, duração/temporadas, categoria e nota |
| Busca por ator via filmografia TMDB | Igual (`fetchTmdbPersonFilmography`) |
| Detalhes: fundo 55%, pôster 360×540 à direita, DETALHES, título, data • avaliação, gêneros, sinopse 4 linhas | Igual |
| Ações: Assistir, Minha Lista, Assistir mais tarde, Trailer | Assistir/Continuar, Minha Lista, Trailer, bloqueio parental |
| Séries Xtream: temporadas e episódios do servidor, cartões 16:9 | Igual, temporadas em abas |
| Recomendações do TMDB em texto | Recomendações do TMDB disponíveis na lista, em pôsteres |
| TMDB: pôster w780, fundo w1280, título, data, até 4 gêneros, trailer HTTPS | Igual, com proteção por título + ano |

## Arquivos

- `services/tmdb.ts`
- `features/catalog/tv-catalog-browser.tsx` (novo)
- `features/details/tv-details.tsx` (novo)
- `app/(tabs)/movies.tsx`
- `app/(tabs)/series.tsx`
- `app/details/[id].tsx`
- `CHANGELOG.md`

## Validação

- Verificação de sintaxe TypeScript dos arquivos alterados.
- Pendente: `npx tsc --noEmit`, `npm test -- --runInBand` e `npm run lint` com as dependências instaladas.
- Pendente teste físico em Fire TV/Google TV: D-pad painel ↔ grade, retorno dos Detalhes com foco no pôster de origem, teclado da busca, catálogo com dezenas de milhares de títulos, trailer e cenário sem token TMDB.
