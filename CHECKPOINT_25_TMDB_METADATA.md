# Checkpoint 25 — Metadados TMDB

## Entrega

- Consulta TMDB para filmes e séries a partir do título do catálogo.
- Cache local de sete dias para reduzir chamadas externas.
- Nota, gêneros, sinopse, elenco e trailer na tela de detalhes.
- Fallback preservado: dados do servidor e sinopse existente continuam disponíveis se a busca falhar.

## Segurança

- A credencial é lida somente de `.env.local` e está excluída deste pacote-fonte.

## Validação

- `npx tsc --noEmit` concluído com sucesso.
