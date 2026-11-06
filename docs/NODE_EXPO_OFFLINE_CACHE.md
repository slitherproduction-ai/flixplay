# Kit offline Node e Expo — ELVANOQ

## Conteúdo

- Node.js `24.19.0` com npm `11.9.0`.
- Dependências do ELVANOQ instaladas pelo `package-lock.json`.
- Expo CLI `57.0.26` e módulos Expo/RN usados no APK 2.17.5.

## Restauração

1. Extraia `ELVANOQ-Node-24.19.0-linux-x86_64.tar.zst` na raiz do cache local.
2. Extraia `ELVANOQ-Expo-57.0.26-node_modules-offline.tar.zst` na raiz do código-fonte do ELVANOQ.
3. Use `PATH=<cache>/node/bin:$PATH` antes de executar o build.

O pacote Expo exclui somente saídas transitórias de compilação Android dentro
de `node_modules`; as dependências de código, os binários de npm e os módulos
nativos necessários para uma nova montagem foram preservados.
