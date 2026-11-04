# Checkpoint 230 — Robustez de reprodução e controle de categorias

## Versão

- **2.17.21**, build **20261039** (anterior: 2.17.20, build 20261038).

## Origem

- Lacunas levantadas na análise do UTM Play 2.0.3 (doc do projeto `claude/analise-utmplay-2.0.3.md`). Só ideias; nenhum código ou texto copiado.

## Alteração

- `app/player.tsx`: watchdog de travamento (intervalo de 4 s, limites 12 s/20 s, máx. 3 tentativas, `pendingSeekRef` para VOD), memória de formato (`features/player/format-memory.ts`), fila de catch-up, atalho de player externo.
- `services/catchup.ts`: `buildCatchupCandidates` e `formatXtreamArchiveStart`; `buildCatchupUrl` mantém o mesmo primeiro endereço.
- `features/parental/adult-categories.ts` + `store/useAppStore.ts`: `isCategoryBlocked`/`toggleCategoryBlocked` com detecção automática e exceções `!<id>`; preferência `parentalAutoAdult` (padrão ligada).
- `features/catalog/hidden-categories.ts` + `app/settings/categories.tsx`: categorias ocultas por servidor (preferência `hiddenCategories`, JSON), aplicadas em Ao vivo, Filmes e Séries.
- `app/settings/parental.tsx`, `app/(tabs)/settings.tsx`, `app/_layout.tsx`: novas opções e rota.
- Testes: `__tests__/features/adult-categories.test.ts`, `__tests__/features/format-memory.test.ts`.

## Validação

- Transpile e checagem de nomes; lógica nova conferida em Node; `tools/verify-release-baseline.sh`.
- Jest e APK pendentes do GitHub Actions; teste físico pendente (travamento simulado desligando o Wi-Fi por 15 s).
