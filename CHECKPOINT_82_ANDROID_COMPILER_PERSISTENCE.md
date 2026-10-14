# Checkpoint 82 — Compilador Android local restaurável

Versão do aplicativo: `2.17.2`.

Este checkpoint registra o ambiente local reutilizável para o APK universal:

- JDK 17, Android SDK 36, Build Tools 35/36, NDK e CMake;
- `node_modules`, cache npm e cache Gradle previamente resolvidos;
- scripts de ativação, verificação e compilação;
- variáveis locais para que ADB e Gradle não dependam de diretórios globais.

Uso:

```bash
source tools/activate-android-build-env.sh
./tools/verify-android-build-env.sh
./tools/build-android-universal.sh
```

O pacote de recuperação do compilador e este checkpoint não incluem `.env`,
tokens, credenciais IPTV, chaves de assinatura ou APKs gerados.
