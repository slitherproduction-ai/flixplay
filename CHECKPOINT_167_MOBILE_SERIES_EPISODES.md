# Checkpoint 167 — Séries mobile: temporadas e episódios

**Versão:** 2.17.15  
**Base:** checkpoint 166 (`0b036206894f8d4d7edeca17485b79cce495439e`)

## Alterações

- A escolha de temporada no smartphone deixa de usar uma longa faixa horizontal de chips.
- Foi criado um seletor compacto que abre um painel inferior com todas as temporadas.
- O painel informa a seleção atual, fecha ao escolher uma temporada e respeita o botão Voltar do Android.
- Os episódios no smartphone continuam em cartões individuais, agora com thumbnail 16:9, tipografia mais contida, metadados legíveis, selo de episódio novo e barra de progresso para retomada.
- A implementação para Android TV/Google TV/Fire TV foi preservada: o seletor expansível por D-pad não usa o painel mobile.

## Arquivos alterados

- `app/details/[id].tsx`
- `CHANGELOG.md`

## Validação

- `git diff --check`
- Validação de baseline de release disponível no repositório.
- Teste físico pendente em smartphone Android: abertura/fechamento do painel, toque em temporadas, rolagem e reprodução de episódio.
