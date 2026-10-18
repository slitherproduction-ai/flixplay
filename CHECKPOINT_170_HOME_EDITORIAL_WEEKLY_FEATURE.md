# Checkpoint 170 — Home editorial e destaque semanal

**Versão:** 2.17.15  
**Base:** checkpoint 169 (`c85cf876ce3877385a54b78644b48ae1f101289a`)

## Alterações

- A Home em TV deixa de enquadrar o hero como cartão: backdrop, gradientes e conteúdo ocupam a área editorial sem bordas ou raio de card.
- O conteúdo do hero recebe ações claras, título e metadados compactos e leitura ancorada no lado esquerdo.
- O destaque da Home agora considera filmes adicionados recentemente e escolhe a maior avaliação. A decisão é persistida por sete dias; quando expira, a próxima opção elegível é escolhida para evitar repetição imediata.
- Sem itens com data recente, a melhor avaliação geral é usada como fallback seguro.
- O menu lateral TV usa ícones de 22 px e alvos de 44 px, preservando sua área de foco estável.

## Arquivos alterados

- `app/(tabs)/index.tsx`
- `components/tv-side-navigation.tsx`
- `CHANGELOG.md`

## Validação

- `git diff --check`
- Validação de baseline de release disponível no repositório.
- Teste físico pendente em TV: escala do hero em 720p/1080p, foco da busca e navegação vertical do menu.
