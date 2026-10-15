# Checkpoint 50 — Concorrência e desempenho do throttler

Adicionado teste automatizado de oito incrementos concorrentes sobre um bucket compartilhado entre dois clientes Prisma. O teste verifica contagem serializada e o bloqueio após ultrapassar o limite. Adicionado script opt-in de amostragem sequencial de 30 operações para medir latência mediana, percentil 95 e duração geral, com limpeza das chaves de teste.

Comando (somente em homologação e com DATABASE_URL isolada): `THROTTLE_BENCH_CONFIRMED=true npm run security:bench-throttle`. O script recusa NODE_ENV=production; não é executado automaticamente. Os números obtidos na infraestrutura de homologação não representam produção. Ainda pendentes: benchmark concorrente de maior escala, monitoramento de lock contention, métricas por instância, otimização de queries e análise de dimensionamento PostgreSQL.

Sem pagamentos, deploy Hostinger, recuperação efetiva de MFA, mutação de licenças produtivas ou nova compilação Android.
