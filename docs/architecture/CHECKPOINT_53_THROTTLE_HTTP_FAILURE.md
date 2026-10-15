# Checkpoint 53 — HTTP durante falhas do armazenamento de throttling

Adicionado `SafeThrottlerGuard` como guarda global do NestJS. Erros inesperados ao consultar o armazenamento compartilhado são tratados como `503 Service Unavailable`, sem permitir acesso quando o limitador não consegue verificar as tentativas. A exceção própria de excesso de requisições continua preservada, para manter a resposta `429` quando o limite é excedido.

Teste HTTP cria uma aplicação NestJS isolada com armazenamento que simula falha e verifica o retorno 503 e mensagem genérica, sem detalhes internos. ELVANOQ Cloud CI #38643862941 aprovado.

Permanece necessária homologação de queda e recuperação real do PostgreSQL em staging, além de observabilidade, testes de carga e política operacional de disponibilidade. Não houve deploy, cobrança, alteração de licenças produtivas ou APK.
