# Checkpoint 161 — Arquitetura estável do menu lateral TV

**Data:** 18/10/2026  
**Versão de referência:** 2.17.14  
**Checkpoint anterior:** 160  
**Base sincronizada:** c204c9ddec2097b1522c7267906bbec6202ce6b3

## Correção

Após análise de padrões públicos de navegação por D-pad, o menu foi ajustado para separar o rail aberto do foco de cada item. No Android TV/Fire TV, o foco pode atravessar elementos por proximidade e disparar eventos transitórios; por isso, componentes visuais não podem ser montados e desmontados a cada item focado.

- Marca, rótulos e versão permanecem montados durante toda a vida do rail.
- No estado compacto, esses elementos são apenas ocultados visualmente e não deixam de existir na árvore de renderização.
- O movimento vertical não recolhe mais o menu.
- A seta direita continua sendo a saída explícita para o conteúdo, com suporte tanto ao evento do item quanto ao emissor nativo do controle remoto.

## Arquivos alterados

- components/tv-side-navigation.tsx
- CHANGELOG.md
- CHECKPOINT_161_TV_MENU_FOCUS_ARCHITECTURE.md

## Validação executada

- Revisão dos eventos Android TV/Fire TV e dos focos direcionais existentes.
- Verificação estática de que rótulos, marca e rodapé não são renderizados condicionalmente.
- Verificação de diferenças e espaços em branco via Git.

## Pendente

- Compilar pelo GitHub Actions e validar fisicamente no Fire TV: cima/baixo rápido, troca de rota com OK, seta esquerda para abrir e seta direita para fechar.
