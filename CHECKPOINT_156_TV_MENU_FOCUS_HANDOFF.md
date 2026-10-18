# Checkpoint 156 — Estabilidade do foco no menu TV

**Data:** 18/10/2026  
**Versão de referência:** 2.17.14  
**Checkpoint anterior:** 155  
**Base sincronizada:** `9820d202df38b510e732e4772f2d588ce69198dd`

## Correção

O vídeo de homologação em Fire TV confirmou que o rail lateral recolhia entre os eventos `blur` e `focus` de itens adjacentes. Como os rótulos são exibidos apenas no estado expandido, eles desapareciam visualmente durante a navegação por D-pad.

O intervalo de transferência de foco foi ajustado para acomodar o hand-off nativo do Fire TV. O foco do próximo item cancela o recolhimento pendente; assim, marca, textos e versão permanecem estáveis durante toda a movimentação interna. Quando o foco sai do menu, o rail continua recolhendo para ícones.

## Arquivos alterados

- `components/tv-side-navigation.tsx`
- `CHANGELOG.md`
- `CHECKPOINT_156_TV_MENU_FOCUS_HANDOFF.md`

## Validação executada

- Análise do vídeo de homologação em 1080p/60 fps.
- Verificação estática do ciclo de foco e cancelamento do temporizador.
- Verificação de diferenças e espaços em branco via Git.

## Pendente

- Compilar pelo GitHub Actions e validar fisicamente no Fire TV: mover rapidamente entre todos os itens do menu e confirmar que ele recolhe apenas ao transferir o foco para o conteúdo.
