# Checkpoint 44 — Respostas administrativas HTTP

Rotas de autenticação e MFA recebem o cabeçalho `Cache-Control: no-store` em cada método: cadastro, login, logout, matrícula e validação MFA, revogação de sessões, revogação de credencial e endpoints internos de recuperação. Os identificadores `:id` dos endpoints de aprovação e consumo experimental de grant agora exigem UUID válido via `ParseUUIDPipe`.

O controle reduz armazenamento indevido de respostas sensíveis, mas não substitui HTTPS, revisão do proxy e testes E2E com requisições HTTP reais. O limitador distribuído continua pendente. A recuperação operacional de MFA permanece indisponível; os grants de teste não redefinem credenciais. Sem liberação de licenças em produção, cobrança, deploy ou APK.
