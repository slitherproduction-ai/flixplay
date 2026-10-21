# Checkpoint 192 — Integração do dispositivo com o Portal

Base: checkpoint 191 / versão em desenvolvimento 2.17.16.

## Entrega

- O Portal ELVANOQ Play vincula o mesmo Endereço MAC e a mesma Chave exibidos pelo aplicativo.
- A consulta de vínculo ocorre em segundo plano na tela de login e não interfere no acesso por Xtream ou M3U.
- Estados exibidos: vínculo pendente, vinculado ou dispositivo inativo. Indisponibilidade do Portal não bloqueia o app.
- A API de consulta não cria dispositivos, não ativa teste de 7 dias, não gera cobrança e não aplica bloqueio de acesso.

## Arquivos

- app/login.tsx
- services/device/portalDeviceStatus.ts
- CHANGELOG.md
