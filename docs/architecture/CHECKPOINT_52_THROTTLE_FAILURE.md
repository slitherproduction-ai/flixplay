# Checkpoint 52 — Erros no armazenamento do throttler

Foi acrescentado um teste automatizado que simula falha na transação da camada PostgreSQL e exige rejeição da chamada de incremento. Não existe fallback silencioso para contadores locais nessa execução. Cloud CI #38641209480 aprovado.

Escopo: teste com erro simulado de transação. Não foi desligado PostgreSQL real, nem realizada homologação HTTP de comportamento de resposta durante indisponibilidade. Antes de produção: exercitar interrupção e restabelecimento do banco em staging, código HTTP esperado, alertas e impacto sobre rotas autenticadas.

O aplicativo ELVANOQ Play 2.17.11, pagamentos, licenças em produção e hospedagem Hostinger não foram alterados.
