# Checkpoint 158 — Correção de bundle da tela de detalhes

**Data:** 18/10/2026  
**Versão de referência:** 2.17.14  
**Checkpoint anterior:** 157  
**Base sincronizada:** `002542206b2b2073b5cfbb27db458ad21d1bf79a`

## Correção

O componente `DetailsContent` possuía `tvMode` duas vezes na desestruturação de parâmetros e duas vezes na tipagem. O Babel interrompia o bundle com `SyntaxError: Argument name clash`.

Foi mantida uma única declaração de `tvMode` em cada local. Nenhum fluxo de filmes, séries, temporadas, episódios ou variação de layout TV/smartphone foi modificado.

## Arquivos alterados

- `app/details/[id].tsx`
- `CHANGELOG.md`
- `CHECKPOINT_158_DETAILS_BUILD_FIX.md`

## Validação executada

- Conferência estática da assinatura completa de `DetailsContent`.
- Busca por parâmetros duplicados no arquivo de detalhes.
- Verificação de diferenças e espaços em branco via Git.

## Pendente

- Executar o bundle/compilação no GitHub Actions, ambiente que possui todas as dependências do projeto.
