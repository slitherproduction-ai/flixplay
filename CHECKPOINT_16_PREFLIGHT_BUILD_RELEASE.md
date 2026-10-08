# Checkpoint 16 — Pré-build e release 2.17.0

Data: 2026-10-07

## Verificações realizadas

- `assembleRelease` foi iniciado e carregou a configuração Expo/React Native, API 36, NDK 27.1.12297006 e arquiteturas `armeabi-v7a,arm64-v8a`.
- A compilação falhou antes do empacotamento: Android SDK não está instalado/configurado (`ANDROID_HOME`, `ANDROID_SDK_ROOT` e `android/local.properties` ausentes).
- Não há APK/AAB de release gerado.
- A configuração exige explicitamente `ELVANOQ_KEYSTORE_FILE`, `ELVANOQ_KEYSTORE_PASSWORD`, `ELVANOQ_KEY_ALIAS` e `ELVANOQ_KEY_PASSWORD` para pacote de release; nenhuma chave foi exposta, copiada ou criada.
- Notas de release candidatas criadas em `release/RELEASE_NOTES_v2.17.0.md`.

## Critérios para encerrar o release

1. Disponibilizar Android SDK 36, Build Tools 36.0.0, NDK 27.1.12297006 e CMake 3.22.1.
2. Fornecer a chave de assinatura já compatível por variáveis de ambiente no ambiente seguro de build.
3. Gerar APK/AAB, registrar SHA-256 e verificar a assinatura.
4. Concluir a homologação física e aprovar todos os fluxos críticos.

Até esses critérios, 2.17.0 permanece Release Candidate.
