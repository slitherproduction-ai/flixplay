# Checkpoint 176 — Refinamento visual do menu lateral TV

Base: checkpoint 175 (`ba51700562c00a57ac39a81c2fd67003b02f59b4`)

## Alterações

- Ícones do rail lateral TV ajustados para 20 px e mantidos no estilo `outline` em todos os estados.
- Removida a troca para o ícone preenchido quando a rota está selecionada, que deixava o menu visualmente pesado.
- Estado selecionado recebeu fundo discreto; foco por D-Pad continua com contorno claro, sem escurecer o item.
- Densidade das linhas foi refinada com altura de 42 px, espaçamento mais equilibrado e barra de rota mais sutil.

## Preservado

- Rail com 68 px recolhido e 216 px expandido.
- Expansão apenas ao entrar no rail; retração ao sair pela direita.
- Itens mantidos montados durante navegação vertical, sem ocultação por opacidade.
