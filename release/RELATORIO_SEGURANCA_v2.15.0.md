# Relatório de segurança — FlixPlay 2.15.0

## Implementado

- Sanitização de logs, URLs autenticadas, tokens, userinfo e caminhos sensíveis.
- Persistência do catálogo remove URLs autenticadas, preservando apenas URLs públicas de imagem quando aplicável.
- Credenciais e PIN usam cofre nativo; PIN protegido com derivação PBKDF2, salt, AES-GCM e bloqueio progressivo.
- HTTPS não recebe downgrade automático para HTTP. HTTP continua permitido somente quando fornecido explicitamente pelo servidor.
- Backup Android desativado no manifesto (`allowBackup=false` e `fullBackupContent=false`).
- `SYSTEM_ALERT_WINDOW` não é usado.

## Limitações

- O certificado histórico mantém compatibilidade de atualização, mas não substitui uma chave privada de produção devidamente custodiada.
- Telemetria permanece desativada por ausência de configuração autorizada.
- Controle parental ainda precisa ser aplicado a todas as rotas antes do lançamento público.
- Minutas jurídicas exigem revisão profissional.

Nenhuma chave privada ou credencial integra o pacote de código-fonte público.
