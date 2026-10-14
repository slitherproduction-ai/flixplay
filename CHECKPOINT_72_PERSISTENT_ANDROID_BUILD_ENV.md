# Checkpoint 72 — Ambiente persistente de compilação Android

Data: 2026-10-10

## Ambiente preparado e mantido localmente

- Dependências Node instaladas (`node_modules`).
- Projeto nativo Android gerado pelo Expo Prebuild.
- Android SDK: Platform 36, Build Tools 36.0.0, Platform Tools, NDK 27.1.12297006 e CMake 3.22.1.
- Gradle 9.3.1 e dependências Android/Expo pré-carregados em `.build-cache/gradle`.
- JDK 17 completo (`javac`) mantido em `.build-cache/jdk-17`.
- Scripts de build e verificação apontam para o JDK persistente do projeto.

## Verificação

- `tools/verify-android-build-env.sh` — aprovado.
- `npx tsc --noEmit` — aprovado.
- `EXPO_NO_TELEMETRY=1 npm run lint` — aprovado.

## Nota operacional

Os caches de compilação foram preservados localmente e não fazem parte do pacote-fonte para evitar uma cópia de vários gigabytes. A próxima geração deverá reutilizar esses recursos; apenas dependências realmente novas precisarão ser baixadas.

## Não incluído

- APK não gerado nesta etapa.
