# Checkpoint 225 — Acabamento premium de Filmes, Séries, Ajustes e Login

## Base

- Versão de desenvolvimento: **2.17.16**.
- Checkpoint anterior: **224**.

## Novos módulos

- `features/catalog/display.ts`: `displayTitle`, `displayCategory`, `titleVariant`, `dedupeTitleVariants`, `findTitleVariants`, `formatNumber`.
- `features/catalog/mobile-catalog-header.tsx`: cabeçalho compacto de Filmes/Séries.
- `features/details/variant-selector.tsx`: seletor de versão (Dublado/Legendado/Nacional/Padrão).

## Regras de agrupamento

- Mesmo título limpo (sem marcações) + mesmo ano = mesmo grupo.
- Representante: Dublado > Padrão > Nacional > Legendado; posição da primeira ocorrência.
- Detalhes listam todas as versões; escolher outra substitui a rota (`/details/<id>`), preservando favoritos e progresso por versão.

## Arquivos alterados

- `components/ui.tsx` (AppText, PosterCard, Chip)
- `app/(tabs)/movies.tsx`, `app/(tabs)/series.tsx`, `app/(tabs)/index.tsx`
- `features/catalog/tv-catalog-browser.tsx`, `features/details/tv-details.tsx`, `app/details/[id].tsx`
- `app/(tabs)/settings.tsx`, `app/login.tsx`
- `CHANGELOG.md`

## Validação

- Verificação de sintaxe TypeScript dos arquivos alterados.
- Pendente: `npx tsc --noEmit`, `npm test -- --runInBand`, `npm run lint` e teste físico com fonte ampliada do sistema, catálogo com versões DUB/LEG e listas com paginação do banco local.
