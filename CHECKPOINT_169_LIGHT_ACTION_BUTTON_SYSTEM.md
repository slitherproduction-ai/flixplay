# Checkpoint 169 — Sistema de botões claros

**Versão:** 2.17.15  
**Base:** checkpoint 168 (`4e1b72c429cdf2b175e9ea664044b0f08d8f396a`)

## Alterações

- Padronizadas as ações antes azuis em superfícies brancas com texto e ícones escuros: recuperação de armazenamento, retry de erro, conexão de servidor, controle parental, disponibilidade/instalação de atualização, sincronização de Filmes e TV ao Vivo e confirmação de saída do player.
- O componente compartilhado de foco para TV deixa de pintar uma superfície de outra cor por padrão: ele preserva o fundo de cada controle e mantém borda azul e escala de foco.
- Azul continua exclusivo para indicadores, progresso, links, estado selecionado e bordas de foco; esses elementos não foram convertidos em botões claros.

## Arquivos alterados

- `components/tv-focusable.tsx`
- `components/ui.tsx`
- `components/update-available-notice.tsx`
- `components/parental-gate.tsx`
- `app/index.tsx`
- `app/_layout.tsx`
- `app/server/add.tsx`
- `app/settings/parental.tsx`
- `app/settings/about.tsx`
- `app/(tabs)/movies.tsx`
- `app/(tabs)/live.tsx`
- `app/player.tsx`
- `CHANGELOG.md`

## Validação

- `git diff --check`
- Validação de baseline de release disponível no repositório.
- Teste físico pendente em TV: foco em botões claros, abertura de modais de atualização/PIN e confirmação de saída do player.
