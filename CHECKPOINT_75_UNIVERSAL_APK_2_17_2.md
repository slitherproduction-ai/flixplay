# Checkpoint 75 — APK universal v2.17.2

Data: 2026-10-10

## Entrega validada

- APK: `release/ELVANOQ-v2.17.2-universal.apk`
- Pacote: `com.fastshot.slitherproduction.flixplay`
- Versão: `2.17.2` (`versionCode 20261017`)
- Arquiteturas: `arm64-v8a` e `armeabi-v7a`
- Assinatura: APK Signature Scheme v2 validada.

## Correções incluídas

- Busca de Filmes e Séries foi movida para o cabeçalho virtualizado da lista, evitando a sobreposição do `FlatList` no Android e mantendo o campo visível e selecionável.
- Splash nativo e a transição interna passaram a usar os recursos V3, com o símbolo atual em fundo escuro e sem a moldura branca externa.
- Histórico de versão atualizado para v2.17.2.

## Validação executada

- `npx tsc --noEmit`
- lint do projeto
- pré-build Android
- montagem release universal
- conferência de pacote, versão, SDK, ABIs e assinatura

## Estabilidade de compilação

O script de montagem agora executa o Gradle com no máximo dois workers e sem paralelismo. Isso reduz picos de memória durante a compilação nativa e preserva o cache persistente para futuras gerações.
