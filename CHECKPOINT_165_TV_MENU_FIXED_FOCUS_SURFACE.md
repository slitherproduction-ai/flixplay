# Checkpoint 165 — Menu TV com superfície de foco fixa

Base: ELVANOQ Play `2.17.15`  
Data: 2026-10-18

## Causa corrigida

O rail anterior alterava a largura do contêiner, dos itens e dos slots de texto
quando abria ou recolhia. No Fire TV, essa mudança faz o mecanismo nativo de
foco recalcular a árvore durante movimentos verticais, podendo ocultar os
rótulos dos itens não selecionados.

## Implementação

- A área de foco lateral agora ocupa permanentemente `216 px`.
- Itens, marca, slots de texto e rodapé permanecem medidos na largura final.
- Ao sair do rail, somente a superfície escura é reduzida para `68 px` e os
  textos recebem opacidade zero; não há mudança de largura nos alvos de foco.
- Filmes, Séries e TV ao Vivo passam a calcular sua largura disponível usando
  a área fixa do rail.

## Arquivos alterados

- `components/tv-side-navigation.tsx`
- `app/(tabs)/movies.tsx`
- `app/(tabs)/series.tsx`
- `app/(tabs)/live.tsx`
- `CHANGELOG.md`

## Teste físico obrigatório

No Fire TV Stick: entrar no menu, subir e descer repetidamente por todos os
itens, sair à direita e retornar à esquerda. Enquanto houver foco no rail,
todos os rótulos devem permanecer visíveis.
