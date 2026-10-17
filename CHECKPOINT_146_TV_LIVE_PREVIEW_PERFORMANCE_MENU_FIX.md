# Checkpoint 146 — TV ao Vivo: preview, desempenho e menu lateral

## Base

- Versão de referência: `2.17.14` (sem incremento de versão)
- Checkpoint anterior: `145`
- Commit-base: `e851228fa9680641fb68d5682990f6b03c631278`

## Alterações

- O painel de preview fica renderizado mesmo enquanto a lista paginada ainda não disponibilizou um canal.
- O `VideoView` do preview usa `textureView`, apropriado para a composição dentro da superfície translúcida e recortada da guia TV.
- A substituição da fonte do preview só ocorre após 180 ms de foco estável; assim, percorrer a lista não reinicia o decodificador a cada linha.
- Na TV, EPG é pré-carregado apenas para o canal estabilizado no preview. A pré-carga de lotes da lista continua disponível fora do modo TV.
- O menu lateral aguarda somente 180 ms para a transferência de foco entre seus itens e recolhe ao foco entrar no conteúdo, evitando encobrir as colunas da guia.

## Arquivos alterados

- `app/(tabs)/live.tsx`
- `components/tv-side-navigation.tsx`
- `CHANGELOG.md`

## Validação executada

- Inspeção do vídeo de reprodução enviado (1920 × 1080, 60 fps), que evidenciou preview ausente, travamento de foco e sobreposição do menu.
- Revisão estática dos fluxos de foco, preview, EPG e composição Android TV.
- `git diff --check` aprovado.

## Pendente de homologação física

- Confirmar o stream real no Android TV/Google TV/Fire TV e percorrer uma lista extensa com D-pad.
- Confirmar a abertura/retração do menu lateral em aparelho físico.
