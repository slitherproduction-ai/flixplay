# Checkpoint 229 — Telas secundárias no padrão premium

## Versão

- **2.17.20**, build **20261038** (anterior: 2.17.19, build 20261037).

## Alteração

- Novo `components/premium-screen.tsx`: `PremiumBackdrop`, `PremiumTopBar`, `PremiumHeading`, `GroupLabel`, `Group`, `GroupRow`, `PremiumButton`, `usePremiumContentStyle` e estilos `premium`.
- Reescritas no padrão: `app/settings/parental.tsx`, `app/settings/player.tsx`, `app/settings/diagnostics.tsx`, `app/server/add.tsx`. Lógica (PIN, preferências, testes, cadastro) preservada.
- Fundo e botão Voltar padronizados: `app/(tabs)/settings.tsx` (celular/tablet e painel de TV), `app/watch-later.tsx`, `app/continue-watching.tsx`, `app/search.tsx` (com área segura e coluna central em tablet/TV), `app/settings/about.tsx` (passa a usar os componentes compartilhados).

## Validação

- Transpile sem erros, checagem de nomes não usados/indefinidos e de chaves de estilo; `tools/verify-release-baseline.sh`.
- Teste físico e APK pendentes da compilação pelo GitHub Actions.
