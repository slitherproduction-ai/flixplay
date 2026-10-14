# Checkpoint 74 — Busca e Splash corrigidos

Data: 2026-10-10

## Correções

- Busca de Filmes e Séries movida para dentro do cabeçalho virtualizado da `FlatList`.
  - Evita que a camada nativa da lista Android cubra o campo.
  - Mantém o `SearchField` estável para preservar foco e teclado durante a digitação.
- Splash de abertura atualizado em dois estágios:
  - Splash nativo Android aponta para o novo símbolo sem moldura branca externa.
  - Tela de transição do app usa as novas artes mobile e TV em tela cheia.
- Novos assets:
  - `ELVANOQ_splash_native_mark_v3.png`
  - `ELVANOQ_splash_mobile_v3.png`
  - `ELVANOQ_splash_tv_v3.png`

## Validação

- `npx tsc --noEmit` concluído com sucesso.
- `npm run lint` concluído com sucesso.
- `expo prebuild --platform android --no-install` executado para sincronizar recursos nativos.
