# Checkpoint 13 — Lint global

Data: 2026-10-06

## Entregue

- Lint global sem erros nem avisos.
- Ajustes seguros em inicialização de estados assíncronos, relógio do EPG e pré-carregamento do guia.
- O helper `inspector-overlay.js`, exclusivo de navegador e fora do bundle Expo/Hermes, foi explicitamente ignorado pelo lint React Native.
- Histórico de versões atualizado.

## Validação

- `eslint .`: aprovado.
- `tsc --noEmit`: aprovado.
- Jest completo: 24 suítes / 108 testes aprovados.

## Próxima sequência

Homologação física em smartphone, Android TV e Fire TV/Fire Stick; depois build/release final. O build local segue dependente de Android SDK instalado no ambiente.
