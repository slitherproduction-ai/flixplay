# Checkpoint 204 — Migração automática de instalações anteriores

Versão: 2.17.16

## Implementação no aplicativo

- O estado persistido `app-storage` continua sendo restaurado pelo cofre seguro antes de qualquer comunicação com o Portal. A migração existente de dados antigos para favoritos, histórico, progresso e configurações por servidor foi preservada.
- Foi criado `legacyPortalMigration`, executado somente após a hidratação do Zustand. Ele é idempotente, não sobrepõe listas, não altera a lista ativa e grava um marcador de retomada separado.
- A identidade existente é sempre reutilizada. Como versões anteriores não tinham MAC/chave do Portal, uma nova identidade local é criada uma única vez apenas quando realmente ausente e passa a ser persistida.
- A requisição de migração transmite somente MAC, chave, nome do aparelho, plataforma e versão. Não transmite Host, URL M3U, XMLTV, usuário, senha, favoritos, histórico ou progresso.
- Uma falha de rede, HTTP 429, timeout ou indisponibilidade preserva os dados e agenda nova tentativa com backoff. O marcador somente fica concluído após confirmação do mesmo MAC/chave pelo Portal.
- Perfis por código restaurados permanecem utilizáveis com o Host já salvo enquanto a migração está pendente. A revalidação/licenciamento por código só é aplicada após confirmação do Portal, evitando que a atualização crie ou reinicie um teste.

## Implementação no Portal

- Migração aplicada: `legacy_device_migration_enrollment`.
- Nova função segura: `portal_legacy_device_migrate`, executável somente pelo `service_role` da Edge Function.
- `portal-control` foi implantada como versão 26 com a ação pública limitada `legacy-device-migrate`, rate-limited por MAC.
- A reativação explícita por administrador/responsável promove o vínculo pendente para verificado, sem alterar licença ou pagamento.
- Novo dispositivo sem comprovação prévia é criado como `active=false` e `migration_status=pending_review`. Não recebe licença, período de teste, pagamento ou ativação.
- MAC já registrado com chave divergente retorna conflito; não há rebind automático.
- O contrato atual não oferece associação automática de uma lista Host/M3U sem enviar conteúdo privado. O app preserva essas listas localmente; o cadastro/sincronização de playlist permanece no fluxo explícito do Portal. Isso é intencional para não enviar URLs ou credenciais durante migração.

## Testes e pendências

- Validada a estrutura real de armazenamento antigo, a migração segura do `app-storage`, o contrato implantado da Edge Function, a função de licença e a função de registro por código.
- Confirmado que o registro por código pode iniciar teste para uma instalação nova; por isso a migração não chama esse endpoint automaticamente.
- Pendente teste físico de atualização por cima de versões anteriores com Host, M3U, Código, múltiplas listas, identidade já vinculada e chave divergente.
