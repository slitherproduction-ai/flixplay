# Checkpoint 207 — Licenciamento de listas sincronizadas por Host/DNS

Versão: 2.17.16

- Listas M3U e Xtream sincronizadas do Portal preservam `sourceType` e passam a revalidar `license-status` pelo MAC/chave persistentes.
- A associação de Host/DNS, `server_code`, `license` e `code_access` é consumida do contrato existente de `playlist-sync`.
- Listas `portalManaged` não chamam `code-device-register`; o Portal já determina o vínculo pelo Host/DNS.
- Uma resposta com `playlist: null` e bloqueio explícito mantém a lista local e interrompe o acesso. Indisponibilidade/429 continuam sendo falhas de rede, não expiração.
- Não foram gerados APKs nem disparados workflows.
