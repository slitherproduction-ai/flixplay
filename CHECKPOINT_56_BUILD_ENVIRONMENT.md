# Checkpoint 56 — ambiente de compilação Android

Este checkpoint torna a geração do APK reprodutível dentro deste workspace.

- JDK: OpenJDK 17 completo (inclui `javac`).
- SDK: `../../android-sdk`, com `platforms;android-36` e `build-tools;36.0.0`.
- NDK: `25.2.9519653`, validado por `source.properties`.
- Cache persistente do projeto: `.build-cache/gradle` e `.build-cache/npm`.
- Sem dependência de `~/.gradle` ou `~/.expo`.
- Validação rápida: `./tools/verify-android-build-env.sh`.
- Geração: `npm run android:universal`.

O script configura `JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `GRADLE_USER_HOME`,
modo CI e telemetria desativada antes de iniciar o Gradle. Assim, novas gerações reutilizam
o cache local e falham cedo com mensagem objetiva se faltar um componente.
