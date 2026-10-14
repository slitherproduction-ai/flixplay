# Checkpoint 76 — Ajustes premium e organizados

Data: 2026-10-10

## Alterações concluídas

- Tela principal de Ajustes reorganizada em: Conta, Reprodução, Segurança, Dados e suporte, Sobre e saída da conta.
- Preferências detalhadas do player saíram da tela principal e foram preservadas em `app/settings/player.tsx`.
- Nova página de Reprodução mantém OSD, salto no vídeo, formato HLS/TS, User-Agent, retomar último canal e modo Android TV.
- Ações de atualização da lista e diagnóstico foram agrupadas com o status atual do servidor em uma faixa compacta.
- Novo visual glass mais leve: bordas sutis, ícones em superfícies translúcidas e ações primárias com destaque moderado.
- Rota `settings/player` registrada no Stack para navegação consistente em smartphone e TV.

## Validação

- Checagem de tipos executada com `npx --no-install tsc --noEmit`.
- O lint não pôde ser executado neste ambiente restaurado porque `node_modules` não está presente; será reexecutado antes do próximo APK.
