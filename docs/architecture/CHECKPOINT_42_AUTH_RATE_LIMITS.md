# Checkpoint 42 — Limites de requisição em autenticação administrativa

A API já tinha um `ThrottlerGuard` global de 10 requisições por minuto. Foram aplicados limites específicos por rota: cadastro de conta 3/minuto, login 5/minuto, matrícula inicial de MFA 2/hora, verificação MFA 5/minuto, solicitação de recuperação MFA 2/minuto, aprovação 3/minuto e consumo de grant de teste 3/minuto.

Esses limites usam o mecanismo padrão de rastreamento por IP do NestJS Throttler **em memória por instância**. São uma proteção adicional e **não substituem** um rate limiter distribuído ou regras do proxy reverso/WAF. Em implantação futura com múltiplas réplicas, configurar armazenamento centralizado e IP de origem confiável, sem aceitar cabeçalhos de proxy não autenticados. A limitação por conta MFA permanece persistida no PostgreSQL, com cinco tentativas e bloqueio de quinze minutos.

Grants de recuperação seguem desativados em produção e não redefinem MFA. Sem alteração de licenças em produção, cobrança, deploy na Hostinger ou APK novo.
