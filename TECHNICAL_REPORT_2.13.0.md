# Relatório técnico — FlixPlay 2.13.0

## Baseline da 2.12.1

- TypeScript: aprovado.
- Lint: aprovado.
- Testes: 6 suítes, 15 testes aprovados.
- Problema adicional do runner: o script usava `--forceExit`; a investigação com `--detectOpenHandles` não encontrou handles abertos e a opção foi removida.

## Problemas encontrados

- Credenciais completas dentro do estado Zustand persistido em texto simples no AsyncStorage.
- Cast com quatro dispositivos inventados e conexão apenas visual.
- Áudio, legendas e buffer definidos por listas fixas sem relação com o stream.
- Texto “FLIXPLAY DEMO”, stream demonstrativo e perfil “Marina” no código de produção.
- Status, conexões e formato de saída estáticos em Ajustes.
- Quick Switcher em `ScrollView`, limitado aos primeiros 12 canais.
- Sincronização sequencial bloqueava o catálogo até canais, filmes e séries terminarem.
- Uma falha em VOD ou séries invalidava toda a sincronização.
- Catálogo apenas em memória, sem cache offline persistente.
- Logs de rede podiam incluir mensagens com URLs sensíveis.
- Player monolítico e estilos/funções antigas não utilizadas.
- Atualizador aceitava qualquer asset com MIME de APK e mantinha uma permissão de instalação não usada.

## Correções implementadas

- Módulo nativo AES/GCM com chave no Android Keystore e migração transacional do estado legado.
- Sanitização centralizada de URLs, paths Xtream, query strings e erros.
- Módulo SQLite nativo por servidor, escrita transacional, paginação e limpeza de órfãos.
- Sincronização progressiva/cancelável com estados independentes para TV, filmes e séries.
- Restauração offline paginada quando o servidor não responde.
- Cast, demo, perfil e buffer fictícios removidos.
- Seletores reais de áudio e legenda com `availableAudioTracks` e `availableSubtitleTracks`.
- Quick Switcher virtualizado, sem truncamento, e zapping D-Pad cima/baixo.
- Busca global com debounce fornecido pelo componente de busca e normalização de acentos.
- Diagnóstico com versão, dispositivo, sistema, status, latência, contagens, cache e erro sanitizado.
- SemVer estrito, asset APK HTTPS validado e permissão `REQUEST_INSTALL_PACKAGES` removida.

## Arquivos e áreas principais alterados

- `android/app/src/main/java/.../security/*`
- `android/app/src/main/java/.../data/*`
- `services/security/*`
- `data/database/catalogDatabase.ts`
- `hooks/useXtreamSync.ts`
- `services/xtream.ts`
- `app/player.tsx`
- `app/search.tsx`
- `app/settings/diagnostics.tsx`
- `app/(tabs)/settings.tsx`
- `store/useAppStore.ts` e `store/types.ts`
- Manifesto, configuração, versão, testes e documentação.

## Decisões arquiteturais

- O estado Zustand continua responsável por UI, favoritos e histórico; catálogos extensos são persistidos em SQLite.
- O cache é separado por `server_id` e `kind`, com índice para paginação estável.
- Credenciais não foram separadas em outro identificador para evitar migração destrutiva: todo o snapshot persistido é cifrado, preservando múltiplos servidores.
- Funções sem backend real foram ocultadas/removidas, em vez de manter controles decorativos.
- Telemetria externa não foi ativada porque não há DSN/chave disponível.

## Testes executados após as mudanças

- `npx tsc --noEmit`: aprovado.
- `npm run lint`: aprovado.
- `npm test -- --runInBand`: aprovado.
- `npx expo config --type public`: aprovado.
- `npx expo export --platform android`: bundle Hermes de produção gerado com sucesso (1.801 módulos).
- Catálogo sintético: 30.000 canais e playlist M3U com 30.000 entradas, sem truncamento.
- `./gradlew :app:compileDebugKotlin --offline --no-daemon`: não executado; o wrapper tentou obter Gradle 9.3.1 e a rede recusou a conexão.
- Certificado preservado no projeto completo: SHA-256 `0E:74:49:7B:84:2B:0F:AC:45:24:CD:2B:19:4F:C3:48:85:7A:17:FF:C1:77:DD:93:4A:68:23:F9:B8:E5:99:F7`.

## Atualização pós-build

- APK universal 2.13.0 gerado posteriormente para `armeabi-v7a` e `arm64-v8a`.
- Versão `2.13.0` e pacote `com.fastshot.slitherproduction.flixplay` confirmados no artefato.
- Certificado do APK comparado diretamente com a versão 2.12.1 e confirmado como idêntico.
- SHA-256 do APK: `7afc7ac9b96c05d3b415b42dec31ea4e53d996787d2009fc49c1ccbcbf5c6e70`.

## Limitações restantes

- O player ainda deve ser dividido fisicamente em componentes menores em uma próxima iteração; o comportamento falso foi removido, mas o arquivo continua grande.
- Controle parental não foi exposto, pois não houve tempo de concluir o bloqueio ponta a ponta sem criar uma função meramente visual.
- Busca de episódios ocorre apenas dentro dos detalhes da série; o índice global ainda cobre canais, filmes e séries.
- SHA-256 do atualizador ainda depende de um downloader nativo controlado pelo app; a versão atual abre o asset HTTPS no navegador e não afirma validação inexistente.
- A homologação física ainda depende dos dispositivos reais listados no checklist.
