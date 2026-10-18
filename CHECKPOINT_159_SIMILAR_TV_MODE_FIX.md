# Checkpoint 159 — Propriedade TV da faixa de recomendações

**Data:** 18/10/2026  
**Versão de referência:** 2.17.14  
**Checkpoint anterior:** 158  
**Base sincronizada:** d52addfc0358e121ba9eb6538952f1e48ca6da10

## Correção

A faixa de recomendações (SimilarSection) usava tvMode para selecionar os estilos de TV, mas não declarava a propriedade na assinatura do componente. Isso causava o erro exibido na TV: Property 'tvMode' doesn't exist.

A propriedade foi adicionada à assinatura e à tipagem de SimilarSection. A chamada já enviava tvMode; portanto, a correção preserva integralmente o layout de filmes e séries em TV e smartphone.

## Arquivos alterados

- app/details/[id].tsx
- CHANGELOG.md
- CHECKPOINT_159_SIMILAR_TV_MODE_FIX.md

## Validação executada

- Conferência cruzada das assinaturas e das referências de tvMode nos componentes da tela de detalhes.
- Verificação estática de parâmetros duplicados e propriedades ausentes.
- Verificação de diferenças e espaços em branco via Git.

## Pendente

- Compilar pelo GitHub Actions e validar a abertura de detalhes de filme e série em TV e smartphone.
