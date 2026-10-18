# Checkpoint 173 — Fundação de refatoração estrutural

Base: checkpoint 172 (`637d3a099f75ba4ae80864337ffd95b9f8cd91e4`)

## Objetivo

Reduzir acoplamento dos maiores fluxos sem alterar layout, navegação por D-Pad, autenticação, preview ou experiência de smartphone.

## Extrações concluídas

- `features/live/tv-guide-panels.tsx`
  - Coluna de categorias TV.
  - Preview nativo de canal com EPG agora/próximo.
  - Mantida substituição estabilizada do decoder e `TextureView` no Fire TV.
- `features/details/synopsis.ts`
  - Limpeza de títulos para consulta.
  - Busca opcional e cache de sinopse.

## Atualizações de integração

- `app/(tabs)/live.tsx` passou a coordenar estado, foco e navegação, delegando os painéis TV.
- `app/details/[id].tsx` delega a busca de sinopse a um módulo de domínio.
- `tools/verify-release-baseline.sh` valida os painéis no novo caminho.

## Garantias

- Nenhuma rota, texto, ação, estilo de foco ou regra de preview foi removida.
- Não há alteração de versão, build ou geração de APK.
