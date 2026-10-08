# Auditoria pré-implementação — FlixPlay 2.15.0

Data da auditoria: 28/09/2026
Base auditada: FlixPlay 2.14.0 (`versionCode 20261005`)
Pacote: `com.fastshot.slitherproduction.flixplay`
Escopo: baseline técnico anterior a qualquer alteração funcional da versão 2.15.0.

## 1. Preservação da base

- Snapshot integral do código-fonte 2.14.0 criado antes das mudanças.
- O projeto recebido não contém metadados Git; portanto, o estado inicial foi registrado por snapshot, inventário e logs de validação, e não por commit.
- A chave histórica de instalação foi mantida apenas no ambiente privado de build. Ela não integra o pacote público de código-fonte.
- O `packageName`, API mínima 24, SDK 36 e ABIs existentes permanecem inalterados nesta etapa.

## 2. Baseline executado

| Validação | Resultado | Evidência |
|---|---:|---|
| TypeScript (`npx tsc --noEmit`) | Aprovado | `audit-logs/typescript-baseline.log` |
| Lint JavaScript/TypeScript | Aprovado | `audit-logs/lint-baseline.log` |
| Jest | 10 suítes e 28 testes aprovados | `audit-logs/jest-baseline.log` |
| Android lint completo | Inconclusivo | dependência de teste `junit:junit:4.13.2` ausente no cache e acesso ao repositório externo indisponível no ambiente |
| Build release Android | Aprovado em 7m15s (659 tarefas) | `audit-logs/android-build-baseline.log` |
| Android lint vital | Aprovado no build release | tarefas `lintVitalAnalyzeRelease`, `lintVitalReportRelease` e `lintVitalRelease` |

O bloqueio do Android lint completo é ambiental e não foi tratado como aprovação. O `lintVitalRelease` será validado pelo build release disponível no cache.

### APK baseline

- Arquivo: `android/app/build/outputs/apk/release/app-release.apk`.
- Tamanho: 72.994.493 bytes.
- SHA-256: `a6d6a227e89bc6f8703223bd5d6a1ad9cafb7be0d98d735091b6272ae6dfa9f1`.
- Package: `com.fastshot.slitherproduction.flixplay`.
- Versão: 2.14.0 (`versionCode 20261005`).
- Min/Target/Compile SDK: 24/36/36.
- ABIs confirmadas: `arm64-v8a` e `armeabi-v7a`.
- Assinatura APK v2 válida.
- Certificado SHA-256: `0e74497b842b0fac4524cd2b194fc348857a17ffc177dd934a6823f9b8e599f7`.

## 3. Inventário

- 140 arquivos no snapshot, desconsiderando `node_modules`.
- 49 arquivos TypeScript/TSX.
- 12.543 linhas TypeScript/TSX, incluindo testes.
- Módulos nativos próprios: `CatalogDatabaseModule`, `CatalogDatabasePackage`, `SecureStorageModule` e `SecureStoragePackage`.
- Permissões declaradas: Internet, estado da rede, Wake Lock, áudio, boot, serviço em primeiro plano e reprodução de mídia. O manifesto gerado também contém leitura/escrita de armazenamento limitadas ao SDK 32 e vibração.

### Maiores componentes

| Arquivo | Linhas | Risco principal |
|---|---:|---|
| `app/player.tsx` | 2.331 | player monolítico, concorrência de eventos e baixa testabilidade |
| `app/login.tsx` | 1.213 | mistura de formulário, TV, persistência e autenticação |
| `app/details/[id].tsx` | 963 | episódios não virtualizados e ações visuais inconsistentes |
| `app/(tabs)/live.tsx` | 790 | filtros sobre catálogo integral em memória |
| `app/settings/about.tsx` | 760 | alegações de recursos e responsabilidades excessivas |
| `components/ui.tsx` | 641 | componentes heterogêneos no mesmo módulo |
| `services/xtream.ts` | 639 | rede, parsing e composição de URLs acoplados |

## 4. Achados críticos

### Banco, memória e sincronização

1. O SQLite não é a fonte principal: o catálogo é restaurado como arrays completos no Zustand.
2. `catalog_items` armazena payloads JSON genéricos, sem schema normalizado, índices de busca ou paginação nativa.
3. A sincronização mantém múltiplas cópias do catálogo: texto HTTP, JSON convertido, arrays, JSON serializado e objetos nativos.
4. URLs de reprodução contendo usuário e senha podem ser persistidas no SQLite.
5. IDs de favoritos/histórico não são compostos por servidor, permitindo colisões entre listas.
6. Troca de servidor pode manter cache do servidor anterior durante a transição.
7. Uma resposta vazia inesperada pode substituir catálogo local válido.
8. Não há migration real: `onUpgrade` não implementa evolução de schema.
9. Busca, filtros, ordenação, contagens e EPG alteram arrays completos em memória.
10. O teste de catálogo grande mede arrays JavaScript, não escrita, paginação ou busca no banco real.

### Player

1. `app/player.tsx` concentra sessão, UI, zapping, EPG, tracks, PiP, progresso, erros e estilos.
2. Fallback de URL pode corromper query string ou fragmento.
3. Eventos atrasados de um stream anterior podem acionar fallback na sessão atual por falta de token de geração.
4. Não há timeout/stall/backoff completo para tentativas de reprodução.
5. Progresso não é garantido em pausa, background e entrada em PiP nativo.
6. O mini-player PiP interno cria outra instância e pode reiniciar VOD.
7. Seek por toque dispara atualizações em excesso.
8. Quick switch é virtualizado, porém filtra o catálogo completo e recalcula favoritos de forma potencialmente quadrática.
9. Faltam ações completas de canal anterior e autoplay do próximo episódio.

### Segurança e privacidade

1. O release usa a configuração histórica de debug para preservar a assinatura de instalação. Isso é compatível com atualizações atuais, porém inadequado para publicação pública sem plano controlado de assinatura.
2. O fallback HTTPS→HTTP é automático e pode reenviar credenciais sem consentimento explícito.
3. URLs credenciadas podem ser persistidas no catálogo local.
4. `allowBackup=true`, configuração de rede ampla e confiança em certificados de usuário ampliam a superfície de exposição.
5. Exclusão do banco é disparada sem aguardar confirmação de sucesso, embora a UI prometa exclusão permanente.
6. O atualizador é um redirecionamento manual, sem download verificado por hash/certificado, mas a interface sugere atualização integrada.
7. A sanitização não cobre todos os aliases e há `console.error` fora do logger sanitizado.
8. O fallback web do cofre usa AsyncStorage; ele não pode ser anunciado como armazenamento seguro.
9. Controle parental, backup, termos, privacidade e telemetria ainda não estão implementados.

### UI/UX e acessibilidade

1. O botão “Trailer” reproduz o conteúdo principal e deve ser removido enquanto não houver trailer real.
2. A retomada exibe progresso fixo de 56% em uma tela.
3. Modais não aprisionam/restauram foco e não declaram corretamente acessibilidade modal.
4. O drawer expande de 68 para 204 px enquanto a cena reserva apenas 68 px, cobrindo conteúdo e causando o bug visual relatado.
5. Não há relações determinísticas completas entre primeira coluna, menu e último card focado.
6. Login da TV inicia corretamente no Host, mas falta uma malha explícita de `nextFocus*` e adaptação 16:9.
7. Busca não preserva foco e limita resultados a 250 após filtrar arrays completos.
8. Episódios são renderizados por `.map()` dentro de `ScrollView`.
9. Diversos alvos touch são menores que 48 dp e faltam labels/estados de acessibilidade.
10. Os grids principais já usam `FlatList`, mostram 5–7 cards na TV e 3/4/5 colunas responsivas no mobile; esse comportamento deve ser preservado.

### Release e testes

1. Alguns testes atuais são scaffolds e não exercitam as telas ou o store reais.
2. Não há cobertura nativa de migrations, banco, SecureStorage, PiP, navegação D-Pad ou sincronização concorrente.
3. A pasta `android/` é ignorada integralmente; módulos nativos próprios não são reproduzíveis por `prebuild` limpo.
4. Não há pipeline de AAB, metadados de loja, símbolos ou source maps de release.
5. Falta banner Android TV 320×180.
6. A tela Sobre anuncia M3U, embora exista apenas parser interno sem fluxo utilizável.

## 5. Decisões para implementação incremental

1. Criar schema versionado e consultas paginadas preservando o banco antigo até a migration ser validada.
2. Evitar persistência de URLs credenciadas e resolver URLs somente no momento da reprodução.
3. Introduzir geração/cancelamento por sessão de sincronização e proteger catálogo válido contra respostas vazias.
4. Extrair do player módulos puros e testáveis antes de alterar sua UI.
5. Remover ou ocultar toda alegação sem fluxo real: trailer, M3U, atualização automática e demais recursos decorativos.
6. Corrigir primeiro a geometria do drawer e a previsibilidade de foco, sem fundir a navegação mobile com a navegação TV.
7. Manter a assinatura atual apenas para compatibilidade de sideload. A publicação pública continuará bloqueada até estratégia de chave, homologação física e validações de loja.

## 6. Classificação inicial

**REPROVADO — BLOQUEADORES PENDENTES.**

A base 2.14.0 compila em TypeScript e passa nos testes existentes, mas os achados de banco/memória, segurança, assinatura de release, testes nativos e ausência de homologação física impedem classificá-la como pronta para lançamento público.
