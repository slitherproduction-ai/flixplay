# Recuperação do FlixPlay 2.11.0

O pacote **Projeto Completo** preserva o código, `node_modules`, projeto Android nativo e a chave de desenvolvimento usada nas versões 2.10.1 e 2.11.0.

## Restaurar o projeto

Junte as partes na ordem e extraia o arquivo:

```bash
cat FlixPlay-v2.11.0-Projeto-Completo.tar.zst.part-* | zstd -dc | tar -xf -
```

## Ambiente Android preservado

Reutilize os pacotes já armazenados:

- `FlixPlay-Android-SDK36-NDK27-CMake.tar.zst.part-*`
- `FlixPlay-Gradle-JDK17-cache.tar.zst.part-*`

Depois de extraí-los, ajuste `android/local.properties` para apontar `sdk.dir` ao SDK restaurado.

## Compilar sem baixar dependências

Use JDK 17, `ANDROID_HOME` e `ANDROID_SDK_ROOT` apontando ao SDK restaurado e `GRADLE_USER_HOME` apontando ao cache restaurado. Execute primeiro `:app:clean` e, em seguida:

```bash
gradle :app:assembleRelease --offline --no-daemon --no-build-cache --max-workers=2
```

Não substitua `android/app/debug.keystore`: ela mantém a compatibilidade de atualização direta entre as versões 2.10.1 e 2.11.0.
