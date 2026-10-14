# Ambiente de compilação Android do ELVANOQ

Este projeto contém um compilador Android local, preparado para gerar o APK
universal sem depender de instalações globais.

## Componentes instalados

- JDK Eclipse Temurin 17.0.20.1
- Android SDK Platform 36
- Android Build Tools 35.0.0 e 36.0.0
- Android NDK 27.1.12297006
- CMake 3.22.1
- Android Platform Tools (ADB)
- Gradle 9.3.1 e dependências já resolvidas
- Cache npm e dependências Node do projeto

## Uso

No diretório do projeto, execute:

```bash
source tools/activate-android-build-env.sh
./tools/verify-android-build-env.sh
./tools/build-android-universal.sh
```

O script de ativação configura `JAVA_HOME`, `ANDROID_HOME`,
`ANDROID_SDK_ROOT`, `ANDROID_SDK_HOME`, `GRADLE_USER_HOME` e o cache npm
apontando apenas para recursos locais do ELVANOQ.

## Segurança

O pacote de recuperação do compilador não inclui `.env`, tokens do TMDB,
credenciais de listas IPTV, chaves de assinatura ou APKs gerados.
