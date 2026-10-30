# Checkpoint 224 — Acabamento premium do sistema visual

## Base

- Versão de desenvolvimento: **2.17.16**.
- Checkpoint anterior: **223**.

## Alterações (componentes compartilhados — alcançam TV, smartphone e tablet)

- `PosterCard`: degradê inferior, selos de qualidade/nota, arte provisória com título, `onError` com recuo, foco somente no pôster (TV) com ampliação 1,06 e sombra.
- `SectionHeader`: "Ver todos" em pílula com foco próprio.
- `IconButton`, `ErrorState`, `EmptyState`: superfícies e foco refinados.
- `LoadingState`: esqueletos de pôster pulsando (`SkeletonPosterRow`, exportado).
- `ChannelLogo`: logotipo inteiro com `contentFit="contain"`; iniciais apenas sem imagem.
- TV ao Vivo (celular): mesmo tratamento de logotipo nas linhas de canal. Linhas da TV preservadas (otimizadas para Fire TV).
- Barra de abas: ícones preenchidos/contorno e cores ajustadas.

## Arquivos

- `components/ui.tsx`
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/live.tsx`
- `CHANGELOG.md`

## Validação

- Verificação de sintaxe TypeScript dos arquivos alterados.
- Pendente: `npx tsc --noEmit`, `npm test -- --runInBand`, `npm run lint` e revisão visual em aparelho (foco D-pad nas fileiras, desempenho do degradê nos pôsteres em Fire TV Stick).
