# Checkpoint 04 — Bloqueio parental na reprodução por detalhes

Data: 2026-10-04

## Implementado nesta etapa

- Conteúdos marcados como protegidos agora solicitam o PIN antes de iniciar a
  reprodução pela tela de detalhes de filmes ou séries.
- A ação de bloquear ou remover o bloqueio do item também solicita o PIN.
- A proteção permanece isolada por servidor através de `userDataByServer`.
- A remoção de um servidor, a saída da conta e a remoção de todas as listas
  limpam a projeção ativa de bloqueios sem afetar outros servidores.

## Validação executada

- `npx tsc --noEmit` — aprovado.
- `EXPO_NO_TELEMETRY=1 npm run lint` — aprovado.
- `npm test -- --runInBand` — 21 suítes, 97 testes aprovados.

## Limites deliberadamente preservados

- A integração completa do PIN nas entradas de TV ao vivo, busca, favoritos,
  histórico, zapping, PiP e último canal ainda é uma fase posterior.
- Nenhum APK foi gerado neste checkpoint; uma release só será criada após as
  integrações restantes e a validação Android correspondente.
