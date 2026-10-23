# Checkpoint 205 — Regularização administrativa da migração

Versão: 2.17.16

- Portal `portal-control` implantado na versão 26.
- A ação administrativa existente de reativar um dispositivo agora marca também `migration_status=verified` quando o responsável confirma o vínculo.
- A atualização não cria licença, período de teste, cobrança, lista ou vínculo automático adicional.
- Na próxima abertura do app, a migração recebe a confirmação do Portal e passa a aplicar as regras aprovadas para perfis por código.
