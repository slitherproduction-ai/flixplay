# ELVANOQ 2.17.0 — Notas de release (Release Candidate)

**Build Android:** `20261015`
**Pacote:** `com.fastshot.slitherproduction.flixplay`
**Estado:** Release Candidate — ainda não autorizada para lançamento público.

## Principais evoluções

- Importação de playlists M3U e associação de guia XMLTV.
- EPG com programação atual/próxima e suporte a catch-up quando declarado pelo provedor.
- Catálogo de canais, filmes e séries com paginação SQLite e virtualização para listas grandes.
- Cobertura de carga simulada para catálogos de 30 mil e 100 mil itens.
- Fluxo Xtream informa falhas 502/525/526 de TLS/SSL do servidor sem classificá-las como credenciais inválidas.
- Lint global, TypeScript e testes automatizados fechados: 25 suítes e 109 testes aprovados.

## Pendências de liberação

- Gerar APK/AAB usando Android SDK 36 e assinatura de release compatível.
- Homologar instalação e atualização em smartphone, Android TV/Google TV e Fire TV/Fire Stick.
- Validar o login em endpoint Xtream com TLS funcional e registrar as evidências.

## Segurança

As notas, relatórios e diagnósticos não contêm credenciais, URLs de streams ou chaves de assinatura.
