# Checkpoint 211 — Cliente compartilhado do Portal

Base: versão 2.17.16, build Android 20261031, branch `main`.

## Escopo

- Centraliza as chamadas públicas para `portal-control` usadas pela resolução de Código, vínculo e licença de dispositivo, sincronização de listas e migração legada.
- Mantém os contratos e as decisões de acesso existentes. Código HTTP 429, 502, 503, 504, timeout e falhas de rede deixam de receber mensagens divergentes entre telas.
- Acrescenta testes unitários para a montagem da requisição de Código e para a classificação de indisponibilidade do Portal.

## Arquivos

- `services/device/portalClient.ts`
- `services/device/serverCodeResolver.ts`
- `services/device/portalDeviceStatus.ts`
- `services/device/portalPlaylistSync.ts`
- `services/device/codeDeviceAccess.ts`
- `services/device/legacyPortalMigration.ts`
- `__tests__/services/portalClient.test.ts`
- `__tests__/services/serverCodeResolver.test.ts`
- `README.md`
- `CHANGELOG.md`

## Limites

Este checkpoint não altera banco de dados, Edge Functions, player, UI, listas locais, credenciais IPTV, pagamentos ou regras de licença. Teste físico em aparelho permanece necessário.
