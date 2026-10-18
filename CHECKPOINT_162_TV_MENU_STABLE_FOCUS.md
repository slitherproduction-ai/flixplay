# Checkpoint 162 — Menu lateral TV com foco estável

Base: ELVANOQ Play 2.17.14  
Data: 2026-10-18

## Correção

O menu lateral da TV não atualiza mais o estado do seu contêiner para cada
movimento vertical do D-pad. O foco visual de cada item continua sendo tratado
pelo próprio `TVFocusable`, enquanto a abertura do rail é registrada uma única
vez quando o foco entra nele.

Também foi removido o segundo tratamento do mesmo evento de controle em cada
item. A saída explícita para a direita é controlada somente pelo receptor de
controle do rail, evitando re-renderizações concorrentes durante a navegação.

## Arquivos alterados

- `components/tv-side-navigation.tsx`
- `CHANGELOG.md`

## Validação prevista

- `git diff --check`
- checagem estática de símbolos removidos e imports
- verificação do bundle/TypeScript quando as dependências estiverem disponíveis

## Teste físico pendente

Validar no Fire TV Stick: entrar no rail, percorrer todos os itens com
setas cima/baixo, sair à direita e retornar à esquerda. Todos os rótulos devem
permanecer visíveis enquanto o foco estiver no rail.
