# Checkpoint 34 — configuração TMDB restaurada

## Concluído

- Restaurada a variável `EXPO_PUBLIC_TMDB_ACCESS_TOKEN` somente no ambiente
  local de compilação.
- Adicionado `.env.example` sem segredo para documentar a configuração.
- Validada uma consulta real ao endpoint oficial do TMDB: HTTP 200, com
  resultados de catálogo retornados.

## Segurança

- O arquivo `.env` permanece ignorado pelo Git e excluído dos arquivos de
  checkpoint.
- O token não é registrado neste documento nem no código-fonte arquivado.

## Próximo passo

- Gerar um novo APK para incorporar a variável no bundle de produção.
