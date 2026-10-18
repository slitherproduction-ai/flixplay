# Checkpoint 149 — Escala compacta de detalhes para TV

## Base

- Versão de referência: `2.17.14` (sem incremento)
- Checkpoint anterior: `148`
- Commit-base: `17fc4c7e464d8886a57a92842a386c79a9184aa8`

## Evidência

- Teste visual em TV mostrou o hero de detalhes de filmes/séries excessivamente alto e as ações/temporadas/episódios desproporcionais ou fora da primeira área útil.

## Alterações

- Hero TV reduzido de 576 px para 414 px.
- Bloco de título, tipografia, metadados e sinopse compactados.
- Botões de assistir, bloquear e assistir mais tarde reduzidos mantendo alvo de foco confortável no D-pad.
- Espaçamento vertical reduzido para trazer o seletor de temporada e os episódios para mais perto da primeira dobra.

## Arquivos alterados

- `app/details/[id].tsx`
- `CHANGELOG.md`

## Validação executada

- Inspeção da referência visual recebida.
- Revisão estática de layout TV e `git diff --check`.

## Homologação pendente

- Validar em Fire TV/Android TV telas de detalhes de filme e série, incluindo foco entre ações, temporadas e episódios.
