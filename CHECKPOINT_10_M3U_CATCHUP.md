# Checkpoint 10 — M3U/XMLTV integrado e Catch-up

Data: 2026-10-05

## Entregue

- Cadastro de servidor permite escolher Xtream ou M3U, com XMLTV opcional.
- Sincronização M3U grava categorias e canais no catálogo; o XMLTV é associado por `tvg-id`.
- Parser M3U reconhece `catchup`, `catchup-days` e `catchup-source`.
- Canais Xtream só habilitam arquivo quando `tv_archive=1` e a duração é positiva.
- O guia apresenta **Assistir do início** somente para programas encerrados e com arquivo explicitamente declarado pelo provedor.
- URLs de arquivo M3U/Xtream permanecem em memória e `catchupSource` é removido da persistência de catálogo.
- Histórico de versões atualizado em Sobre.

## Validação

- `tsc --noEmit`: aprovado.
- ESLint dos arquivos alterados: aprovado.
- Jest: `catchup.test.ts` + `xmltv.test.ts`, 5 testes aprovados.

## Próxima sequência

Paginação e virtualização total, seguida dos testes de carga 30k/100k.
