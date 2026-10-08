# Relatório de testes — FlixPlay 2.15.0

## Automação executada

| Verificação | Resultado | Evidência |
|---|---:|---|
| TypeScript (`npx tsc --noEmit`) | Aprovado | Sem erros |
| Lint JS/TS | Aprovado | Sem erros |
| Jest | Aprovado | 18 suítes, 88 testes |
| Gradle release | Aprovado | APK e AAB gerados |
| `lintVitalRelease` | Aprovado | Integrado ao build release |
| Assinatura APK/AAB | Aprovado | Certificado SHA-256 `0e7449…99f7` |
| Metadados do APK | Aprovado | 2.15.0/20261006, API 24/36, ARM 32/64 |
| Android lint completo | Inconclusivo | Dependência JUnit ausente no cache offline |

Os testes de 30 mil e 50 mil itens são testes sintéticos/de contrato. Não constituem medição física de memória ou ANR.

## Não executado

- Homologação física em Fire TV, Android TV, Google TV, smartphone API 24 e tablet.
- Atualização real sobre 2.12.1, 2.13.0 e 2.14.0.
- Streams reais representativos de HLS, TS, múltiplos áudios, legendas e PiP em toda a matriz.

Consequentemente, esta entrega é uma Release Candidate e não está autorizada para lançamento público.
