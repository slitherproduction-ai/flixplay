# Checkpoint 190 — Controle parental por categoria

Base: checkpoint 189 / versão em desenvolvimento 2.17.16.

## Entrega

- Após validar o PIN parental, Ajustes apresenta Canais, Filmes e Séries em seções expansíveis.
- Cada categoria possui um cadeado à esquerda para bloquear ou liberar individualmente.
- Os bloqueios são persistidos por servidor, sem misturar preferências entre listas.
- Filmes e séries mantêm o identificador de categoria recebido do servidor.
- O player consulta o bloqueio de categoria antes de iniciar reprodução e durante a troca de canais.

## Validação

- `git diff --check`: aprovado.
- Busca de referências aos novos campos e ações: aprovada.
- `tools/verify-release-baseline.sh`: base aprovada 2.17.15 / build 20261030.
- TypeScript completo não executado: dependências locais não estão instaladas neste ambiente.

## Arquivos

- `app/settings/parental.tsx`
- `app/player.tsx`
- `services/xtream.ts`
- `store/types.ts`
- `store/serverScopedData.ts`
- `store/useAppStore.ts`
- `CHANGELOG.md`
