# Checkpoint 88 — Guia ao Vivo para TV

## Entregue

- Tipografia compactada na tela `TV ao Vivo` para leitura confortável a distância.
- Filtro selecionado com azul premium, substituindo o estado branco de alto contraste.
- Painel de prévia do canal focado no lado direito da interface TV.
- Carregamento do EPG prioriza imediatamente o canal que recebe foco.
- O painel apresenta programa atual, horários, progresso e próximo programa; informa o carregamento quando a grade ainda não chegou.
- Linhas da lista TV ficaram mais compactas para equilibrar a grade e a prévia.

## Validação

- `npx tsc --noEmit`
- `npm test -- --runInBand __tests__/tv-navigation.test.ts __tests__/core/hydrate-paged-channels.test.ts __tests__/services/epg.test.ts`

Todos os testes selecionados passaram.
