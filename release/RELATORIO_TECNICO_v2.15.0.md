# Relatório técnico — FlixPlay 2.15.0

## Identificação

- Versão: 2.15.0.
- Build: 20261006.
- Package: `com.fastshot.slitherproduction.flixplay`.
- Android: min 24, target/compile 36.
- ABIs: `armeabi-v7a` e `arm64-v8a`.
- Gradle: 9.3.1.

## Principais alterações

- Schema SQLite v2 com índices, paginação, busca e operações incrementais.
- Política de sincronização por etapas com proteção contra catálogo vazio e troca de servidor.
- Player parcialmente modularizado em resolução de stream, sessão, progresso e erros.
- Progresso real salvo em pausa, saída, PiP e background.
- Foco D-Pad e menu lateral corrigidos; login TV inicia no Host/URL.
- Armazenamento e logs sanitizados; PIN parental protegido pelo módulo nativo.
- Alegações não implementadas removidas da interface.

## Débitos restantes

- SQLite ainda não é a única fonte de verdade em todas as telas.
- Controle parental não cobre todas as rotas.
- Backup/restauração e gestão avançada de categorias não foram concluídos.
- Atualizador permanece manual.
- Homologação física está pendente.

Decisão: **REPROVADO — BLOQUEADORES PENDENTES para lançamento público**. Os artefatos podem ser usados em beta fechada controlada.

## Artefatos validados

| Artefato | Tamanho | SHA-256 |
|---|---:|---|
| APK universal | 73.015.241 bytes | `0ea1cb05afeb6ecb21e7d262c4318d8d8b791e734421256479e249246defc394` |
| Android App Bundle | 57.109.392 bytes | `fcb980d3f276f9d5ea238dafc9576719bc70f7f6069eea9f44992d97c1458385` |
| Símbolos nativos | 12.714.246 bytes | `899860df6e6d2ed14e8312f36f44466080a5c6ee9f1652816f99d74630edfea7` |
| Source maps | 3.469.761 bytes | `a483752c6dae0e6acab364796c12911eca15428448e9bc78d8f34120d9c47d0f` |

Certificado SHA-256: `0e74497b842b0fac4524cd2b194fc348857a17ffc177dd934a6823f9b8e599f7`.

O APK passou na verificação de assinatura v2. O AAB passou em `jarsigner`. O manifesto final confirma `allowBackup=false`, `fullBackupContent=false`, min SDK 24, target/compile SDK 36 e ausência de `SYSTEM_ALERT_WINDOW`/`REQUEST_INSTALL_PACKAGES`.
