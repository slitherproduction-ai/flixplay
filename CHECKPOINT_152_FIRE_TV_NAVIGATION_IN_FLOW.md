# Checkpoint 152 — Menu TV no fluxo do layout

**Data:** 18/10/2026  
**Versão de referência:** 2.17.14  
**Checkpoint anterior:** 151  
**Base sincronizada:** `4c27db23bcf6523ad1bab7d4198d58ba1efd9bff`

## Correção

O teste físico confirmou que o menu lateral ainda perdia ícones e textos. O rail era renderizado em uma camada absoluta sobre o navegador de abas. Em Fire TV, a composição nativa da cena pode ser redesenhada sobre esse tipo de camada, ignorando a elevação visual configurada.

O menu agora é uma coluna fixa no fluxo horizontal do layout TV. O conteúdo das abas ocupa apenas o espaço restante; não há mais sobreposição, `zIndex` ou `elevation` disputando a mesma superfície.

## Arquivos alterados

- `app/(tabs)/_layout.tsx`
- `CHANGELOG.md`
- `CHECKPOINT_152_FIRE_TV_NAVIGATION_IN_FLOW.md`

## Validação executada

- Verificação estática do layout e das dimensões reservadas para a navegação TV.
- Verificação de diferenças e espaços em branco via Git.

## Pendente

- Compilar pelo GitHub Actions e validar no Fire TV: os ícones, rótulos e versão do menu devem permanecer visíveis ao navegar entre as abas.
