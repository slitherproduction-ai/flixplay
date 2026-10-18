# Checkpoint 160 — Estabilidade definitiva do menu lateral TV

**Data:** 18/10/2026  
**Versão de referência:** 2.17.14  
**Checkpoint anterior:** 159  
**Base sincronizada:** 63bd80a9a859bde8596aa64f586c64a151ec55f9

## Correção

A navegação vertical no Fire TV dispara eventos de blur temporários entre itens. O menu usava esses eventos para recolher o rail, removendo marca, textos e versão durante a movimentação.

O recolhimento foi desacoplado do blur individual. Enquanto o foco se move entre opções do rail, todos os elementos permanecem montados e visíveis. O menu agora recolhe exclusivamente quando o usuário usa a seta direita para transferir o foco ao conteúdo, que é a saída explícita do rail.

## Arquivos alterados

- components/tv-side-navigation.tsx
- CHANGELOG.md
- CHECKPOINT_160_TV_MENU_STABLE_RAIL.md

## Validação executada

- Revisão estática dos caminhos de foco vertical, foco lateral e saída para conteúdo.
- Verificação de remoção do temporizador de blur e das renderizações condicionais durante a navegação.
- Verificação de diferenças e espaços em branco via Git.

## Pendente

- Compilar pelo GitHub Actions e validar no Fire TV: percorrer rapidamente todos os itens com cima/baixo e, em seguida, usar direita para confirmar o recolhimento.
