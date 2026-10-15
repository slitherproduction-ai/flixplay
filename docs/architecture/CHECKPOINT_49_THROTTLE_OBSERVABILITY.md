# Checkpoint 49 — Observabilidade do limitador PostgreSQL

Adicionadas métricas agregadas `total`, `expired` e `activelyBlocked` à camada de armazenamento do limitador. O comando manual de limpeza (protegido por `THROTTLE_PURGE_CONFIRMED=true`) registra JSON estruturado com os contadores antes/depois, a quantidade removida e a duração da operação em milissegundos. Nenhum identificador de bucket, IP ou token é incluído nas métricas.

Teste de integração confirma os campos agregados e a ausência da chave do bucket no relatório. Nenhuma execução de manutenção foi realizada em produção. Ainda são necessários testes de carga, instrumentação de latência por requisição, definição de alertas operacionais e homologação da configuração do proxy reverso antes de um deploy distribuído.

ELVANOQ Play v2.17.11 permanece inalterado; nenhuma cobrança, alteração de licença em produção, redefinição real de MFA, implantação Hostinger ou APK novo.
