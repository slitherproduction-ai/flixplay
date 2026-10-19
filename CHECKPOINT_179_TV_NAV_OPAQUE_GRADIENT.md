# Checkpoint 179 — Menu lateral TV opaco com degradê

Base: checkpoint 178 (`34c3d69af2c9eafec054b7d2a717084307367fbc`)

## Correção

- Removidos do rail lateral TV os tratamentos translúcidos de glass e quaisquer superfícies de blur.
- Superfície do menu substituída por degradê totalmente opaco, do azul quase preto à esquerda para tom escuro limpo à direita.
- Seleção, foco, pressão, rótulos, divisor e versão agora usam cores opacas.
- Sombra/elevation adicional do foco foi neutralizada especificamente nos itens do menu.

## Objetivo

Reduzir as camadas de composição do menu que podem falhar ao serem repintadas pelo compositor da Fire TV durante a navegação vertical.

## Preservado

- Centralização da lista, ícones de 18 px, D-Pad, expansão/retração e largura do rail.
