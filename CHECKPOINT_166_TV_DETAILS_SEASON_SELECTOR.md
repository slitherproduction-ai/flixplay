# Checkpoint 166 — Detalhes TV e seletor de temporadas

Base: ELVANOQ Play `2.17.15`  
Data: 2026-10-18

## Interface TV

- Hero visual mais baixo e conteúdo editorial concentrado na área inferior.
- Título, metadados, sinopse e ações reduzidos para a mesma escala da Tela Inicial e da TV ao Vivo.
- Cards de episódios e recomendações compactados para exibir mais conteúdo útil na primeira navegação.

## Séries

- O controle de temporadas TV agora é um seletor expansível: `Temporada X` abre as temporadas disponíveis e fecha após a seleção.
- A lista de episódios é atualizada com a temporada escolhida.
- A interface smartphone mantém os chips horizontais existentes.

## Arquivos alterados

- `app/details/[id].tsx`
- `CHANGELOG.md`

## Teste físico obrigatório

No Fire TV: abrir uma série com mais de uma temporada, focar o seletor,
pressionar OK, navegar pelas temporadas, confirmar uma opção e iniciar um
episódio. Verificar também filmes, séries e smartphone.
