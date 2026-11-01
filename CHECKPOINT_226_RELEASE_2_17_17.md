# Checkpoint 226 — Release 2.17.17

## Versão

- **2.17.17**, build **20261035** (anterior: 2.17.16, build 20261034).
- Alinhados: `package.json`, `app.json` (version e versionCode), `android/app/build.gradle`, `constants/app.ts` e histórico em `app/settings/about.tsx`.
- `CHANGELOG.md`: alterações dos checkpoints 221–225 e das correções de desempenho movidas para a seção 2.17.17.

## Conteúdo

- Correções de desempenho para Fire TV Stick Lite e 1ª geração (carrossel isolado, pôsteres leves e memorizados na TV, rodapé do catálogo isolado, sem desfoque/aproximação na TV).
- Correção do agrupamento de títulos sem bloquear a interface em catálogos grandes.
- Início hub do Roku, Filmes/Séries/Detalhes no formato do Roku (TV e tablet na horizontal), versões agrupadas, Ajustes e Login renovados.

## Validação

- `tools/verify-release-baseline.sh`: aprovado (ELVANOQ 2.17.17, build 20261035).
- Pendente: `npx tsc --noEmit`, `npm test -- --runInBand`, `npm run lint`, `tools/verify-android-build-env.sh` e teste físico em Fire TV Stick Lite/1ª geração, smartphone e tablet.
