# Checkpoint 147 — Retorno de homologação Fire TV Stick

## Base

- Versão de referência: `2.17.14` (sem incremento)
- Checkpoint anterior: `146`
- Commit-base: `bf8b353708d268d15ffcd585ae75aecef8f1f8a1`

## Evidência recebida

- O APK `ELVANOQ-v2.17.14-universal(3).apk` contém o bundle do checkpoint 146, incluindo o marcador de preview `Selecione um canal para assistir`.
- O teste físico reportou que preview, desempenho da lista e menu lateral continuaram sem alteração perceptível.

## Correções substitutivas

- As linhas da lista TV deixam de usar `GlassCard`/`BlurView`; cada item usa uma superfície leve, preservando logo e nome do canal.
- As contagens das categorias passam a ser calculadas uma vez em mapa, não mais por filtros repetidos a cada atualização de foco.
- O painel de preview não é desmontado pela mudança de foco da rota; somente o player é pausado quando a tela não está ativa.
- O menu lateral recolhe no próprio evento de perda de foco e reserva apenas 64 px no contêiner, sem camada invisível de 216 px sobre o conteúdo.

## Arquivos alterados

- `app/(tabs)/live.tsx`
- `components/tv-side-navigation.tsx`
- `CHANGELOG.md`

## Validação executada

- Inspeção do bundle dentro do APK entregue.
- Revisão estática de fluxo de renderização, foco e virtualização.
- `git diff --check` aprovado.

## Homologação pendente

- Instalar APK compilado deste checkpoint em Fire TV Stick e validar preview, rolagem contínua e navegação Menu → Categorias → Canais.
