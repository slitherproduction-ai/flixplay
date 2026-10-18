# Checkpoint 175 — Rail lateral TV recolhido de forma real

Base: checkpoint 174 (`397a99a6d02f90d50ec28099dbfbe5254a6aa7bf`)

## Correção

- Rail lateral passou a medir 68 px quando recolhido e 216 px somente quando o foco entra nele.
- Itens navegáveis permanecem montados; a largura não muda ao subir ou descer pelo D-Pad.
- Textos e marca deixam de ser ocultados por `opacity`, mecanismo que causava falha de repintura no Fire TV.
- O layout recorta os rótulos fora da largura de ícones no estado recolhido, eliminando a faixa vazia e o fundo residual do item selecionado.

## Fluxo esperado

- Esquerda no conteúdo: entra no rail e o expande.
- Cima/baixo no rail: todos os ícones e rótulos continuam visíveis.
- Direita: retorna ao conteúdo e recolhe para ícones, sem espaço vazio.
