# Checkpoint 73 — APK universal v2.17.1

Data: 2026-10-10

## Entrega validada

- APK: `release/ELVANOQ-v2.17.1-universal.apk`
- Pacote: `com.fastshot.slitherproduction.flixplay`
- Versão: `2.17.1` (`versionCode` `20261016`)
- SDK mínimo/alvo: `24` / `36`
- Arquiteturas: `armeabi-v7a` e `arm64-v8a`
- Assinatura: APK Signature Scheme v2 validado.

## Ambiente persistente corrigido

- Os scripts de build e validação passaram a apontar o SDK para a raiz real do workspace.
- A configuração local de build do TMDB foi restaurada fora dos arquivos de checkpoint e dos pacotes fonte.
- O repositório de certificados do JDK de build foi atualizado para permitir a recuperação de dependências do Gradle.
- O NDK `27.1.12297006` corrompido foi reinstalado e permanece no SDK persistente.
- Dependências Gradle, SDK Android, NDK, JDK e cache nativo foram preservados para as próximas compilações.

## Verificação executada

- `assembleRelease` concluído com sucesso.
- Metadados do APK, ABIs e assinatura conferidos localmente.
