# Checkpoint 30 — APK universal de homologação

Data: 2026-10-07

## Entrega

- APK: `ELVANOQ-v2.17.0-branding-visual-universal-test.apk`
- Pacote: `com.fastshot.slitherproduction.flixplay`
- Versão: `2.17.0` (`versionCode 20261015`)
- Arquiteturas incluídas: `armeabi-v7a` e `arm64-v8a`
- SHA-256: `a1b0a400d1578b82661afcce6902100490fa37b1a39cabecb60328fb894d63f2`

## Compatibilidade prevista

- Android smartphones e tablets ARM de 32 e 64 bits.
- Android TV e Google TV ARM de 32 e 64 bits.
- Fire TV e Fire Stick ARM de 32 e 64 bits.

## Validações

- Assinatura APK v2 validada por `apksigner`.
- Estrutura do APK validada por `unzip -t`.
- Bibliotecas `armeabi-v7a` e `arm64-v8a` confirmadas dentro do pacote.
- O splash de TV foi convertido para PNG real antes da compilação.

## Observação de instalação

Este APK de homologação usa a chave temporária disponível no ambiente. Ele não atualiza instalações assinadas pela chave original; desinstale a versão atual antes de instalar este arquivo.
