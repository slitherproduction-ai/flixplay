# Checkpoint 26 — EPG nas listas paginadas

## Entrega

- Reidratação não mutável dos itens vindos da paginação SQLite.
- Cards de canais recebem `Agora`, `A seguir`, progresso e guia atualizados da memória.
- Pré-carregamento existente continua protegido por fila e limite de concorrência.

## Validação

- Teste unitário: `hydratePagedChannelsWithEpg` (2 cenários) aprovado.
- `npx tsc --noEmit` aprovado.

## Segurança

- Pacote-fonte exclui `.env*`, chaves e dependências instaladas.
