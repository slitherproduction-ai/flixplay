# Checkpoint 41 — Revisão dos controles MFA administrativos

## Correções aplicadas

- `AdminMfaService.verify` aplica o bloqueio temporário **antes** da validação do formato do TOTP: um código malformado não contorna o bloqueio.
- O consumo atômico do contador TOTP agora exige credencial não revogada e ausência de bloqueio ativo.
- Caso uma sessão seja invalidada durante a transação, uma exceção provoca **rollback** do consumo do contador TOTP, evitando inutilizar o código de um administrador legítimo.
- Teste de regressão cobre código malformado durante bloqueio ativo.

## Itens em aberto para homologação

Limitação de requisições por IP e por conta, recuperação com comprovação independente de identidade, invalidação de todas as sessões após mudanças críticas, revisão de risco de CSRF/origem e exposição de tokens, testes adversariais simultâneos e testes E2E do portal. Grants de recuperação continuam desabilitados em produção e não redefinem MFA.

Sem alterações no APK Android 2.17.11, Hostinger, pagamentos ou operações de licença em produção.
