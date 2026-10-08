# FlixPlay 2.13.0 — Build 20261004

Esta versão prepara o FlixPlay para homologação beta fechada, priorizando segurança, dados reais e estabilidade em catálogos extensos.

## Destaques

- Credenciais protegidas pelo Android Keystore e migração automática das instalações 2.12.1.
- Sincronização progressiva: canais primeiro, filmes e séries em segundo plano.
- Catálogo persistente em SQLite por servidor, com recuperação offline.
- Player usa somente áudio e legendas realmente disponíveis no stream.
- Cast e buffer simulados foram removidos.
- Zapping completo e virtualizado, sem limite artificial de 12 canais.
- Busca global e área de diagnóstico com relatório sem credenciais.
- Permissão de instalação de pacotes removida do aplicativo.

## Atualização

O pacote permanece `com.fastshot.slitherproduction.flixplay`. Para atualizar sem reinstalar, o APK final deve ser assinado com o mesmo certificado das versões 2.11.0–2.12.1.

## Estado do build

O código-fonte passou em TypeScript, lint e testes automatizados. O APK desta revisão deve ser gerado em um ambiente com Gradle 9.3.1, Android SDK 36 e a chave de assinatura anterior. O build não foi declarado como concluído neste ambiente porque a distribuição Gradle não estava disponível.
