# Checkpoint 01 — ELVANOQ 2.17.0

Base recuperada: ELVANOQ 2.16.4 (build 20261014).

Alterações implementadas neste checkpoint:

- Dados de favoritos e histórico isolados por `serverId`, com migração idempotente dos dados legados somente para o servidor ativo.
- Remoção de um servidor limpa apenas o seu bloco de dados locais.
- Campo `addedAt` mapeado da resposta Xtream e usado para a ordenação “Mais recentes”.
- Busca e ordenação passam a ser aplicadas também na visão Favoritos de filmes.
- A sincronização não cancela filmes e séries quando a etapa independente de canais falha; também deixa de publicar percentuais artificiais.
- Atualização de versão para 2.17.0 / build 20261015 e histórico limitado às versões 2.17.0 e 2.16.4.

Validações já executadas:

- `npx tsc --noEmit`: aprovado.
- Jest: 20 suítes, 95 testes aprovados.
- ESLint: aprovado com `EXPO_NO_TELEMETRY=1` no ambiente isolado.

Pendências bloqueadoras de artefato assinado:

- A chave privada de assinatura não está presente nesta cópia de código-fonte sem segredos. Não gerar release com outra chave, pois isso quebraria a linhagem de atualização já existente.
