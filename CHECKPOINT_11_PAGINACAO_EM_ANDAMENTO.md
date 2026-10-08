# Checkpoint 11 — Paginação/virtualização (em andamento)

Data: 2026-10-05

## Implementado neste ponto

- Migração aditiva do SQLite do catálogo para a versão 3, com `category_name` normalizado e índice para filtros de categoria.
- Ponte nativa `filteredPage`: paginação, busca, categoria e ordenação executadas no SQLite, com lotes limitados a 200.
- Hook `useCatalogPagination` com carregamento incremental de 80 itens e descarte de respostas obsoletas.
- Tela **Filmes** usa a consulta paginada no Android para catálogo normal, busca, categoria e ordenação; favoritos continuam usando o conjunto local, que é pequeno e personalizado.
- Renderização mantém `FlatList`, janelas de virtualização e D-Pad existentes.

## Validação parcial

- `tsc --noEmit`: aprovado.
- ESLint dos arquivos alterados: aprovado.
- Testes de contrato do catálogo e catálogo grande: 5 testes aprovados.

## Continuação obrigatória

Aplicar a mesma fonte paginada a TV ao Vivo e Séries, validar 30k/100k e somente então fechar o checkpoint final desta etapa.
