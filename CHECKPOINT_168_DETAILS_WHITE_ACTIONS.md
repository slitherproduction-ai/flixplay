# Checkpoint 168 — Botões claros em detalhes

**Versão:** 2.17.15  
**Base:** checkpoint 167 (`a711ffa0cca44a3e38063ab59ab29464ee9e499c`)

## Alterações

- As ações de detalhes de filmes e séries (`Assistir agora`, `Trailer`, `Bloquear` e `Mais tarde`) agora compartilham o acabamento branco, tipografia escura, altura e raio visual do botão principal.
- Estados de favorito e bloqueio preservam sua identificação por cor no ícone, texto e borda, sem trocar o fundo branco.
- Em Android TV, Google TV e Fire TV, o foco mantém a superfície branca e aplica apenas a borda azul; não há escurecimento ao navegar.
- O seletor de temporada e o menu expansível na TV também usam fundo branco, mantendo boa leitura mesmo quando se sobrepõem à área de ações.

## Arquivos alterados

- `app/details/[id].tsx`
- `CHANGELOG.md`

## Validação

- `git diff --check`
- Validação de baseline de release disponível no repositório.
- Teste físico pendente: foco por D-pad em cada botão e abertura do seletor de temporada na TV.
