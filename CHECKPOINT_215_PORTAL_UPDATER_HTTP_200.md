# Checkpoint 215 — Correção de resposta HTTP 200 do Portal

- Base: versão `2.17.16` (`20261031`), posterior ao checkpoint 214.
- Corrigida a verificação de atualização que classificava uma resposta HTTP `200 OK` como erro antes da leitura de `release.json`.
- O contrato publicado foi consultado diretamente: a release `2.17.16` possui `version`, `size`, `sha256`, `notes`, `published_at`, `ready` e URL oficial do APK válidos.
- Adicionado teste de regressão específico para garantir que uma resposta `200` válida resulte em atualização disponível quando a versão remota for superior.
