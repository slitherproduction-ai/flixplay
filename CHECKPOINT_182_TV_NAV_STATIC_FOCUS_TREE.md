# Checkpoint 182 — Árvore de foco fixa no menu lateral TV

Base: checkpoint 181 (`b991830dde2ac5cdc99bdb59e3622b57f97429e9`)

## Diagnóstico aplicado

Em Fire TV, eventos de foco podem chegar em sequência durante o D-Pad. Alterar o layout, a largura ou a árvore de botões a cada evento pode causar perda visual ou de foco. A orientação técnica pesquisada é manter `onFocus` leve e evitar renderizações desnecessárias durante a movimentação.

## Reconstrução

- A coluna interativa contém exclusivamente cinco botões de ícone, em posição e dimensão fixas (64 px de rail; ícones de 12 px; botões de 42 px).
- Nenhum botão de navegação contém texto, muda largura, é ocultado ou é remontado durante cima/baixo.
- Ao entrar no rail, é montada uma única camada visual opaca com o degradê e os rótulos alinhados aos ícones.
- Essa camada não recebe foco nem eventos de toque; por isso não participa da navegação nativa e não pode remover/reinserir o item focado.
- Durante a navegação vertical, `onFocus` não atualiza estado após a primeira entrada no rail.
- Direita desmonta apenas a camada visual e devolve o foco à tela de conteúdo.

## Resultado esperado

Comportamento idêntico ao vídeo de referência: ícones em coluna quando o conteúdo está focado e rótulos revelados em painel lateral ao entrar no menu, permanecendo visíveis em toda a navegação vertical.
