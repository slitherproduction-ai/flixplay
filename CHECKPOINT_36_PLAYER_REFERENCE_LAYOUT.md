# Checkpoint 36 — Player: composição de referência

## Etapa concluída

O OSD do player foi reorganizado para seguir a composição da referência sem
alterar o motor de vídeo, PiP, EPG, zapping, controles parentais ou navegação
por controle remoto.

## Alterações visuais

- Barra superior limpa: retorno à esquerda e ações reais do player à direita.
- Controles de reprodução transportados para o centro do vídeo.
- Trilhos verticais de brilho e volume posicionados nas laterais, fora das
  informações e da timeline.
- Bloco inferior com logo, tipo de conteúdo, título, programa atual/estado,
  indicador LIVE e barra de progresso.
- Painéis de áudio, legendas, velocidade e proporção preservados na base.

## Comportamento preservado

- Live: controles centralizados trocam o canal anterior/próximo.
- VOD/Séries: controles centralizados retrocedem/avançam 10 segundos.
- O botão central mantém o foco preferencial da TV.
- Os controles laterais continuam acessíveis por toque.

## Validação

- `npx tsc --noEmit`: aprovado.
- `EXPO_NO_TELEMETRY=1 npm run lint`: aprovado.
- Testes do player: 3 suítes, 13 testes aprovados.
- Nenhum APK foi gerado nesta etapa.
