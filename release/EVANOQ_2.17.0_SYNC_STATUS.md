# EVANOQ 2.17.0 — sincronização pendente

Data: 2026-10-08.

Este branch registra a preparação para migrar o código do antigo FlixPlay 2.13.0 para EVANOQ 2.17.0. **A árvore de código da versão 2.17.0 ainda NÃO foi enviada ao GitHub. Não usar este branch para gerar um release.**

Fonte local de referência: `ELVANOQ-2.17.0-checkpoint-45-reproducible-arm-build-source-no-secrets.tar.zst` (checkpoint 45, sem segredos). A fonte está preservada na Biblioteca do usuário, não neste repositório.

Escopo da sincronização completa: player/OSD, favoritos, PIN parental, ação Trailer com ícone, identidade visual, M3U/XMLTV/catch-up, EPG, metadados TMDB, paginação SQLite, cache, diagnóstico, testes e documentação.

Regras:
- Não sobrescrever as correções do checkpoint 45 com a versão 2.13.0.
- Não incluir keystore, passwords, tokens, arquivos `.env`, caches ou binários temporários.
- Preservar o package `com.fastshot.slitherproduction.flixplay`, SDK mínimo 24 e ABIs ARMv7/ARM64.
- Checar reprodução no smartphone, Android TV e Fire TV/FireStick antes do release.
- Validar e sincronizar os fontes Android nativos; não assumir que o Android antigo representa a versão atual.

**Estado: somente preparação de branch. Publicação do código-fonte completo e do release ainda pendentes.**
