# ELVANOQ 2.17.0 — Relatório técnico parcial

## Base e compatibilidade

- Package preservado: `com.fastshot.slitherproduction.flixplay`.
- Android mínimo: API 24.
- ABIs preservadas: `armeabi-v7a` e `arm64-v8a`.
- Identidade visual ELVANOQ preservada.
- Versão: 2.17.0, build 20261015.

## Implementado

| Item | Evidência | Estado |
|---|---|---|
| Isolamento de favoritos e histórico por servidor | `store/serverScopedData.ts`, migração da persistência e troca de projeção ao alternar servidor | Implementado e testado unitariamente |
| Migração de dados legados | Dados globais passam uma única vez ao servidor ativo, sem serem copiados para os demais | Implementado e testado unitariamente |
| Remoção seletiva de dados | Remover uma lista elimina somente seu bloco de dados e o banco daquele servidor | Implementado |
| Ordenação de filmes | `addedAt` vem de `XtreamVodStream.added`; “Mais recentes” não usa mais ano de lançamento | Implementado |
| Busca/ordenação em favoritos de filmes | Aplicadas antes da ordenação em `movies.tsx` | Implementado |
| Sincronização parcial | Falha de canais não cancela a tentativa independente de filmes e séries | Implementado |
| Progresso não fictício | Etapas usam estados textuais; percentuais artificiais removidos | Implementado |

## Validações executadas

| Validação | Resultado |
|---|---|
| `npx tsc --noEmit` | Aprovado |
| `EXPO_NO_TELEMETRY=1 npm run lint` | Aprovado |
| `npm test -- --runInBand` | 20 suítes, 95 testes aprovados |
| Gradle 9.3.1 | Baixado para o cache persistente; lint/debug em andamento neste ambiente |

## Limitações e pendências

- O fluxo completo de PIN parental em todas as entradas, M3U/XMLTV, player externo, catch-up e paginação completa de todas as telas requerem fases dedicadas; não foram marcados como entregues nesta atualização parcial.
- Não há keystore privada nesta árvore de fontes sem segredos. Portanto, nenhum APK/AAB release deve ser gerado com uma chave substituta.
- A assinatura criada nas versões recentes não atualiza instalações ainda assinadas pelo certificado histórico anterior; a compatibilidade depende de manter a chave da linhagem correta.
- Homologação física em smartphone, Android TV e Fire TV permanece pendente.
