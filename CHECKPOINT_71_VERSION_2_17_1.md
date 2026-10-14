# Checkpoint 71 — Versão 2.17.1

Data: 2026-10-09

## Entregue

- Versão do aplicativo atualizada de `2.17.0` para `2.17.1`.
- Build Android incrementado de `20261015` para `20261016`, permitindo instalação por atualização.
- Metadados do Expo, pacote npm, lockfile, identificador exibido e nome do APK universal atualizados.
- Histórico de Versões reorganizado: `v2.17.1` é a versão atual e contém as melhorias recentes; `v2.17.0` permanece como versão anterior.

## Validação

- `npx tsc --noEmit` — aprovado
- `EXPO_NO_TELEMETRY=1 npm run lint` — aprovado
- `npm test -- --runInBand` — 26 suítes, 111 testes aprovados

## Não incluído

- APK não gerado nesta etapa.
