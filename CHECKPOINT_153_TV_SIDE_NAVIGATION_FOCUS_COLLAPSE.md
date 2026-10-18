# Checkpoint 153 — Recolhimento do menu lateral por foco

**Data:** 18/10/2026  
**Versão de referência:** 2.17.14  
**Checkpoint anterior:** 152  
**Base sincronizada:** `e66c2dd83e5a3212b3f81fe802a1bb37c33a3f28`

## Correção

O menu lateral da TV agora segue o comportamento de serviços de streaming: fica recolhido em uma coluna de ícones enquanto o foco está no conteúdo e expande para mostrar marca, rótulos e versão quando o usuário entra no menu.

O recolhimento é acionado somente após o foco realmente sair da região do menu. Uma proteção de 110 ms impede que o rail pisque quando o foco muda entre itens adjacentes da própria navegação.

## Arquivos alterados

- `components/tv-side-navigation.tsx`
- `CHANGELOG.md`
- `CHECKPOINT_153_TV_SIDE_NAVIGATION_FOCUS_COLLAPSE.md`

## Validação executada

- Verificação estática do estado de foco e dos tamanhos expandido/recolhido.
- Verificação de diferenças e espaços em branco via Git.

## Pendente

- Compilar pelo GitHub Actions e validar no Fire TV o ciclo completo: conteúdo → menu expandido → conteúdo → menu recolhido.
