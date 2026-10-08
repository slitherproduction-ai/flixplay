# Recuperação do projeto FlixPlay 2.13.0

## Código limpo

O ZIP de código limpo não contém `node_modules`, caches, builds, APKs ou arquivos de chave. Após extrair:

```bash
npm ci
npx tsc --noEmit
npm run lint
npm test -- --runInBand
```

Para gerar o Android, instale JDK 17, Android SDK 36, Build Tools compatíveis, NDK `27.1.12297006` e Gradle 9.3.1. Configure `sdk.dir` ou `ANDROID_HOME` e execute:

```bash
cd android
./gradlew assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a
```

## Projeto completo

O arquivo completo é dividido em partes. Concatene na ordem e valide antes de extrair:

```bash
cat FlixPlay-v2.13.0-Projeto-Completo.tar.zst.part-* > FlixPlay-v2.13.0-Projeto-Completo.tar.zst
zstd -t FlixPlay-v2.13.0-Projeto-Completo.tar.zst
zstd -dc FlixPlay-v2.13.0-Projeto-Completo.tar.zst | tar -xf -
```

O projeto completo preserva o material necessário para manter a assinatura já utilizada. Trate esse artefato como confidencial. A distribuição pública deve usar somente o ZIP limpo e o APK final.

## Assinatura

O certificado esperado tem SHA-256:

`0E:74:49:7B:84:2B:0F:AC:45:24:CD:2B:19:4F:C3:48:85:7A:17:FF:C1:77:DD:93:4A:68:23:F9:B8:E5:99:F7`

Não substitua a chave: outra assinatura impede atualização direta das versões anteriores.
