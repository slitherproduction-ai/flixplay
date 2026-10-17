# CHECKPOINT 145 — Integração de interação do menu lateral

**Versão-base:** 2.17.14  
**Base anterior:** checkpoint 144 / commit `87c25dc0edf3574040cc2d55e693f0bb5f328038`  
**Commit de implementação:** `2cfa54c753dfefacc942dc16dc1b4818a4e71c47`

## Alteração

O contêiner externo da navegação lateral da TV agora usa `pointerEvents="box-none"`.

Isso preserva a interação do conteúdo atrás da área transparente do painel expandido quando o menu está recolhido, sem alterar a navegação por D-Pad, a aparência do menu ou a versão do aplicativo.

## Arquivo alterado

- `components/tv-side-navigation.tsx`

## Validação pendente

- Testar em Android TV/Fire TV a abertura do menu com **esquerda**, a navegação entre os itens e o retorno ao conteúdo com **direita**.
- Em ambientes com toque/mouse, confirmar que a área transparente ao lado do menu não bloqueia o conteúdo.
