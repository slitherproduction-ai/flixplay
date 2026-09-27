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
- Permissão de sobreposição removida dos manifestos de depuração.

## Atualização

O pacote permanece `com.fastshot.slitherproduction.flixplay`. Para atualizar sem reinstalar, o APK final deve ser assinado com o mesmo certificado das versões 2.11.0–2.12.1.

## Estado do build

- TypeScript e lint concluídos sem erros.
- 25 testes automatizados aprovados em 9 suítes.
- Expo config validado e bundle Android de produção gerado com sucesso.
- APK universal gerado para `armeabi-v7a` e `arm64-v8a`.
- Certificado de assinatura confirmado como idêntico ao da versão 2.12.1.
- SHA-256 do APK: `7afc7ac9b96c05d3b415b42dec31ea4e53d996787d2009fc49c1ccbcbf5c6e70`.
- A homologação física nos dispositivos do checklist continua pendente.
