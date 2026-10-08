# Checkpoint 27 — Player compacto e responsivo

## Entrega

- OSD com barra superior e ações reduzidas.
- Painel inferior compacto, centralizado e com largura máxima para telas grandes.
- Linha de EPG, timeline e controles centrais menores.
- Sliders verticais de brilho visual e volume fora do painel inferior, com camada superior para preservar o toque.
- Brilho é aplicado visualmente sobre o vídeo; volume é aplicado ao player nativo.

## Preservado

- EPG, troca rápida de canais, PiP, player externo, áudio, legendas, velocidade, proporção e controle remoto.

## Segurança

- O pacote-fonte não contém `.env.local`, tokens, chaves de assinatura ou dependências.

## Validação

- Teste unitário do EPG paginado aprovado (2 cenários).
- Lint concluído para player, detalhes, lista ao vivo, TMDB e reidratação de EPG.
