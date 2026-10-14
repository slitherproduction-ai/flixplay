# Checkpoint 90 — OSD do player no controle remoto

## Entregue

- Qualquer interação primária com o OSD oculto volta a exibir os controles.
- `OK/Enter` reabre o OSD com o foco no controle central de reprodução.
- `↑` reabre o OSD diretamente na primeira opção da barra superior.
- Com o OSD visível, `↑` desloca o foco ao topo e o D-Pad navega os controles sem acionar atalhos ocultos de canal.
- Troca de canais permanece disponível pelas teclas dedicadas de canal.

## Validação

- `npx tsc --noEmit`
- `npm test -- --runInBand __tests__/player-runtime.test.ts __tests__/player-config.test.ts __tests__/tv-navigation.test.ts`

Todos os testes selecionados passaram.
