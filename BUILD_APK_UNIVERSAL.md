# Build universal do ELVANOQ

O projeto preserva o código, o `package-lock.json`, o Gradle Wrapper e as
configurações Android necessárias para reconstruir o APK sem depender de uma
máquina específica. Os checkpoints não incluem credenciais, `node_modules` ou
o SDK Android.

## Requisitos

- JDK 17 completo (incluindo `javac`)
- Android SDK com API 36, Build Tools 36.0.0 e NDK 27.1.12297006
- Node.js compatível com o projeto

## Comando único

```bash
npm run android:universal
```

Na primeira execução, as dependências são obtidas e armazenadas em
`.build-cache/`. Nas próximas gerações no mesmo diretório de trabalho, o npm e
o Gradle reutilizam esse cache. Para mantê-lo entre restaurações, defina
`ELVANOQ_BUILD_CACHE` para um volume persistente. O script recria a pasta
Android automaticamente quando ela não estiver presente no checkpoint.

O APK resultante fica em `release/ELVANOQ-v2.17.0-universal.apk` e contém
apenas `armeabi-v7a` e `arm64-v8a`. As arquiteturas de emulador `x86` e
`x86_64` ficam fora do pacote para reduzir o tamanho.
