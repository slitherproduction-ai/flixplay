# Checkpoint 213 — Qualidade, módulos e validação TV

Base: ELVANOQ Play 2.17.16, build Android 20261031, após CP212.

## Entrega

- Amplia cobertura automatizada para resolução por Código (403/404/429/503), sincronização de lista do Portal, bloqueio explícito, migração legada, validação do Login e parsing de episódios.
- Extrai regras puras de Login, episódios de Detalhes e navegação de episódios do Player para módulos testáveis, sem alterar layout ou rotas.
- Adiciona roteiro físico de Fire TV/Fire Stick para validar catálogo grande, memória, preview, player e navegação remota.

## Arquivos principais

- `features/login/loginValidation.ts`
- `features/details/seriesEpisodes.ts`
- `features/player/seriesNavigation.ts`
- `__tests__/features/login/loginValidation.test.ts`
- `__tests__/features/details/seriesEpisodes.test.ts`
- `__tests__/services/portalPlaylistSync.test.ts`
- `__tests__/services/legacyPortalMigration.test.ts`
- `docs/FIRE_STICK_PERFORMANCE_VALIDATION.md`

## Limites

O fluxo permanece compatível com HTTP de provedores IPTV. Teste físico de Fire Stick, incluindo uso real de memória e decoder, depende do aparelho e não é considerado concluído por este checkpoint.
