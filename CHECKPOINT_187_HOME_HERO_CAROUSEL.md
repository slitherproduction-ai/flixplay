# Checkpoint 187 — Carrossel de destaques da tela inicial

## Base

- Versão de desenvolvimento: **2.17.16**.
- Checkpoint anterior: **186**.

## Implementação

- Hero da tela inicial alterna a cada 9 segundos entre os destaques distintos:
  1. Recém-adicionado.
  2. Destaque da semana.
  3. Mais avaliado.
- A seleção é calculada exclusivamente a partir do catálogo já carregado; não há requisição, lista duplicada ou pré-carregamento adicional.
- Imagem e conteúdo usam transição curta; os indicadores mostram o item ativo.
- Em Android TV, Google TV e Fire TV, a rotação é pausada enquanto Assistir agora ou Detalhes possui foco.
- A sinopse do hero na TV pode exibir até três linhas.
- Títulos repetidos não são alternados sob rótulos diferentes quando o catálogo possui poucos itens.

## Arquivos

- `app/(tabs)/index.tsx`
- `CHANGELOG.md`
