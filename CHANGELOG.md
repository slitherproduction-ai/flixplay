# Changelog

## [2.17.49] — 2026-11-12

- Diagnóstico do Fire TV Stick HD na 2.17.47: 2 encerramentos (16:44 na Início com 0 min de app aberto; 16:50 em /movies com 6 min), 2 avisos de pouca memória (último crítico), 183 de 901 MB livres, maior pausa 0,7 s (antes 2,0 s). O registro técnico só tinha "Player/ended-early: [object Object] (4x)" — nenhum marco de sincronização.
- `sanitizeError` mostra objetos como JSON (antes "[object Object]").
- Registro de sessão leva a atividade da sincronização (`setPerformanceActivity`, alimentado pelo `setSyncState`): o encerramento inesperado mostra "durante: Baixando filmes: …". Abertura registra a decisão (catálogo salvo recente / antigo / sem catálogo).
- Catálogo salvo "recente" mas com 0 filmes ou 0 séries e categorias gravadas: sincroniza de novo na abertura (antes ficava vazio por até 6 h).
- Sincronização nativa em lotes de 500 itens em aparelhos de até 1,6 GB ou `isLowRamDevice` (2.000 nos demais).
- Build Android `20261067`.

## [2.17.48] — 2026-11-12

- Player (TV, filmes e episódios): a barra de tempo virou um `TVFocusable` (só com o OSD aberto). Com o foco nela, ◀/▶ voltam e avançam pelo `seekStepSeconds` (mín. 5 s), com aceleração ao apertar seguido (×3 a partir do 4º toque em até 0,7 s, ×6 a partir do 7º). ◀/▶ apontam para a própria barra (`nextFocusLeft/Right`) para o foco não sair dela; dica na tela enquanto ela está focada. A tecla chega pelo `ELVANOQ_REMOTE_KEY` (`usePlayerRemote` → `isTimelineFocused`/`onTimelineStep`).
- Diagnóstico redesenhado: faixa de resumo (canais, filmes, séries, versão e perfil), ações em botões compactos no topo (foco inicial em "Testar conexão") e três painéis lado a lado na TV/tablet — Conexão e aparelho, Desempenho, Atividade recente (encerramentos, pausas e registro técnico). Linhas de 12 pt; painéis focáveis para a tela rolar com o controle. Celular: os mesmos painéis em coluna.
- Build Android `20261066`.

## [2.17.47] — 2026-11-12

- Catálogo instantâneo na TV (pedido: o app não pode depender de minutos de download). Como no Roku e na LG:
  - A sincronização começa pelas categorias de filmes e séries (antes dos canais), grava no banco e já publica `vodCategories`/`seriesCategories` com `vodRevision`/`seriesRevision`, então a grade da TV abre em modo de páginas do banco mesmo vazio.
  - Categoria aberta e vazia no banco é baixada na hora (`get_vod_streams`/`get_series` com `category_id`) e gravada com `upsert`: filmes já tinham `useVodCategoryFallback`; séries ganharam `useSeriesCategoryFallback` ligado ao `onCategoryDemand` do `TvCatalogBrowser`.
  - "Todas" vazia na primeira abertura carrega sozinha a primeira categoria, para a grade não abrir em branco.
  - A lista completa (nativa) segue em segundo plano e, ao terminar, troca tudo de uma vez (inclui o que foi carregado sob demanda). As etapas de filmes/séries reaproveitam as categorias já baixadas.
- Build Android `20261065`.

## [2.17.46] — 2026-11-12

- Fire TV Stick HD sem filmes e séries (0/0, "Última sincronização: Não informado") sem o usuário ter reconstruído o banco, e sem nenhuma linha de sincronização no Desempenho: a sincronização não está terminando, e o `logTechnicalError` só escrevia no console de desenvolvimento — no aparelho não ficava nada.
- Registro técnico: `logTechnicalError` e o novo `logTechnicalEvent` (marcos "Canais/Filmes/Séries: início / concluído") vão para um registro de 12 entradas (repetições agrupadas), sanitizado e gravado no aparelho 0,5 s depois — sobrevive ao fechamento pelo sistema. Diagnóstico → Desempenho mostra as 6 últimas e "Sincronização agora"; o relatório compartilhado leva todas. "Limpar histórico" apaga o registro.
- Build Android `20261064`.

## [2.17.45] — 2026-11-12

- Diagnóstico do Fire TV Stick HD (AFTSS, 901 MB, perfil Básico, v2.17.40): 4 encerramentos inesperados em ~20 min (/series, /movies, /player), 6 avisos de pouca memória (último crítico), 221–250 MB livres no último registro, maior pausa 2,0 s.
- Capas no tamanho do uso (`features/images/sizedImage.ts`): endereços do TMDB trocam `original`/`w600…`/`w1280` por w185/w342/w500 (pôster), w780/w1280 (fundo) e w185/w300 (episódio) conforme o perfil do aparelho. Aplicado em grade da TV, fileiras, Início, detalhes, busca, Continuar assistindo, Assistir depois e player. Outros servidores sem mudança.
- Perfil Básico: ao abrir o player, `Image.clearMemoryCache()` libera as capas decodificadas das telas de baixo; filmes e séries não são sincronizados com um vídeo aberto (`waitWhilePlaying`).
- Build Android `20261063`.

## [2.17.44] — 2026-11-12

- Player: novo formato "Automático" (padrão, primeiro do menu). Lê o tamanho do vídeo (`availableVideoTracks[].size` no `sourceLoad`) e usa "cobrir" quando o formato do vídeo difere até 15% do da tela (1,85:1 e 2:1 numa TV 16:9 enchem a tela com corte pequeno); formatos bem diferentes (2,39:1, 4:3) ficam inteiros com faixas pretas. `features/player/aspectFit.ts` + teste.
- O formato escolhido no menu do player fica salvo (`playerAspectMode`) e vale para todos os vídeos. Build Android `20261062`.

## [2.17.43] — 2026-11-12

- Player: a capa (`backdrop`) ficava atrás do `VideoView` o tempo todo; em filmes mais largos que a tela (2,39:1) ou mais estreitos, as faixas do "Ajustar" mostravam a capa nas margens. Agora a capa só aparece enquanto o vídeo carrega (`videoReady`, ligado no `readyToPlay`; o player da prévia do ao vivo já entra pronto) e volta a cada episódio novo. Faixas pretas, como em qualquer player. Build Android `20261061`.

## [2.17.42] — 2026-11-12

- Séries: causa real do pulo em cascata. O próximo episódio abre na mesma tela do player (`router.replace`) e `episodeEnded` era um booleano: no primeiro render do episódio novo ele ainda estava `true` do anterior, e o efeito de avanço rodava antes do reset → avançava de novo, sem fim. Agora o estado guarda o id do episódio que terminou (`endedEpisodeId`), e a troca de episódio zera tempo, duração, "já começou", retomadas e seek pendente.
- Voltar nas seções (Ao vivo, Filmes, Séries) voltou a fechar o app em vez de ir à Início. O código do Voltar não mudou desde a 2.17.32; a mudança de comportamento coincide com o R8 ligado na 2.17.36, que pode ter removido algo que o React Native acha por reflexão no caminho do Voltar (o JS nem chega a receber a tecla). R8 desligado (`android.enableMinifyInReleaseBuilds=false`); regras mantidas para um teste futuro com build de depuração. Baseline Profile continua.
- Mini player: a 2.17.36 trocou o lugar errado e o `PiPOverlay` (com um ExoPlayer vazio) continuava sempre montado. Corrigido: `PiPOverlayHost` na raiz, `PiPOverlay` só quando ativo.
- Build Android `20261060`.

## [2.17.41] — 2026-11-12

- Séries: o player pulava episódio atrás de episódio sozinho (vídeo do usuário: T1:E139 → E149 em 17 s, tela parada em 0:00). O `playToEnd` chegava sem o vídeo ter tocado (servidor entregando arquivo vazio/cortado) e acionava o próximo episódio. Agora só é fim de verdade se o vídeo andou e chegou a 90% ou a 5 s do final (`playedToTheEnd`); senão tenta o endereço alternativo e, sem ele, mostra o erro com "Tentar novamente". Vale também para filmes. Registro técnico `Player/ended-early`. Build Android `20261059`.

## [2.17.40] — 2026-11-11

- Sincronização nativa mais rápida (medido na Philco de 1,6 GB: 32.292 filmes em 60 s): INSERT compilado e reaproveitado (`SQLiteStatement`) em vez de `ContentValues` + `insertWithOnConflict` por item; lotes de 2.000 itens por transação (antes 400); `PRAGMA synchronous=NORMAL` com WAL (o banco é só cache).
- A troca da lista (DELETE da antiga + UPDATE do `kind` da área temporária) roda no `CatalogStreamJob`, na thread da sincronização. Antes rodava na thread dos módulos nativos e as consultas de página da grade ficavam na fila até ela terminar.
- `streamCatalog` devolve `{ count, committed, totalMs, writeMs, commitMs }`; o Desempenho mostra "Android · gravação N s" para separar o tempo de gravação do de download.
- Build Android `20261058`.

## [2.17.39] — 2026-11-11

- Atualização automática do catálogo com o app aberto (`useXtreamSync`): além da abertura, o app confere a idade do catálogo ao voltar do segundo plano (5 s depois), a cada 15 min e ao fechar o player; com mais de `CATALOG_FRESH_MS` (6 h) desde a última sincronização completa ou tentativa, sincroniza de novo em segundo plano, com a lista atual na tela até a nova ser trocada. Nunca com o player ou o mini player aberto (`services/playbackActivity.ts`). Build Android `20261057`.

## [2.17.38] — 2026-11-11

- Sobre o app: a 2.17.36 usou a etiqueta "Novo" no histórico, que não existe em `TAG_COLORS` (`Novidade`/`Melhoria`/`Correção`), e a tela caía em "Cannot read property 'backgroundColor' of undefined". Etiquetas corrigidas para "Novidade" e `ChangeRow` passa a usar as cores de "Melhoria" para qualquer etiqueta desconhecida. Build Android `20261056`.

## [2.17.37] — 2026-11-11

- Sincronização nativa de filmes e séries na TV (`CatalogStreamJob.kt`): o Android baixa a lista (com redirecionamento http↔https e o mesmo User-Agent), lê o JSON em fluxo com `JsonReader` e grava direto na área temporária do SQLite em lotes de 400, numa thread própria. O JS só acompanha o progresso (`catalogStreamProgress`, a cada 1 s) e decide a troca (`commitStaging`) com as mesmas verificações de segurança. O mapeamento repete `mapVodStreamToMovie`/`mapSeriesStreamToItem`, sem URL de reprodução nem credenciais no payload; formatos de clones (`data`/`results`/`streams`, objeto por id) são aceitos. Resposta que o leitor nativo não entende cai no caminho em JS de antes (inclusive por categoria nos aparelhos fracos). Celular segue com o catálogo em memória.
- Banco local em modo WAL: a grade continua lendo páginas enquanto a sincronização grava.
- Baseline Profile (`src/main/baseline-prof.txt`) + `androidx.profileinstaller`: React Native, Hermes, Expo, Media3, OkHttp, Glide e o código do app pré-compilados na instalação, inclusive em APK instalado fora da loja.
- Build Android `20261055`.

## [2.17.36] — 2026-11-11

- APK de release com R8 (`android.enableMinifyInReleaseBuilds=true`, `proguard-android-optimize.txt`): remove código não usado e otimiza o restante, para abertura mais rápida e menos memória. Sem ofuscação (`-dontobfuscate`) e com `keep` para o código do app, Expo e bibliotecas registradas por reflexão. `shrinkResources` segue desligado (imagens buscadas pelo nome). Memória do Gradle no CI subiu para 3 GB por causa do R8.
- Diagnóstico → Desempenho (TV e celular), via `services/performanceMonitor.ts`: perfil do aparelho, tempo de abertura (início do processo até Início/login), memória livre do aparelho e do app, avisos de pouca memória do sistema (`onTrimMemory`), pausas da interface acima de 0,4 s com a tela em que ocorreram, duração de cada etapa da sincronização e encerramentos inesperados da sessão anterior (app sumiu com a tela aberta, com a rota, a versão e a memória livre do último registro). Tudo entra no "Compartilhar relatório", sem dados da conta.
- `ElvanoqDeviceProfile.getMemorySnapshot()` no módulo nativo, sem leitura de PSS (barata).
- Diagnóstico: totais de filmes e séries lidos do banco local (na TV a memória só tem uma amostra). Build Android `20261054`.

## [2.17.35] — 2026-11-10

- Filmes e Séries (TV): ao passar por "Todas" no painel de categorias, a grade que remontava com o novo conteúdo puxava o foco (primeiro pôster ou o pôster lembrado via `hasTVPreferredFocus`) e o usuário era jogado para os títulos. A grade só pode pegar o foco enquanto o usuário está nela ou na abertura da seção (`gridMayFocus`); na abertura, o foco inicial fica em "Todas" e não em "Buscar".
- Filmes e Séries (TV): ← na primeira coluna da grade leva à categoria selecionada (`nextFocusLeft`), em vez da linha mais próxima na tela, que muitas vezes era "Buscar título ou ator" e trocava a grade para a busca.
- Aparelhos de pouca memória (`deviceTier` "low": Fire TV Stick HD, Fire TV Stick 4K 1ª geração, TVs de até 1,5 GB): filmes e séries são baixados categoria por categoria e gravados direto no SQLite (`writeTvSnapshotParts`), sem nunca ter a lista inteira na memória. A troca só acontece no fim, numa transação; se o servidor falhar em mais de 20% das categorias, o catálogo salvo é mantido. Painel que ignora `category_id` cai no modo antigo sem baixar de novo.
- Leitura das respostas Xtream sem as cópias de `replace`/`trim` do texto inteiro (pico de memória menor em listas grandes).
- Mini player (PiP) montado só quando ativo: antes havia um ExoPlayer vazio vivo o tempo todo. Build Android `20261053`.

## [2.17.34] — 2026-11-10

- Android TV e Fire TV passam a consultar o catálogo de filmes e séries no SQLite em páginas de 80 títulos. Build Android `20261052`.

## [2.17.33] — 2026-11-08

Correções e desempenho da auditoria técnica de 08/11/2026.

- Ao vivo: o número do canal vem do campo `num` do painel Xtream (antes era o `stream_id`, ex.: 18452). Sem `num`, usa a posição na lista. Digitar o número no controle volta a abrir o canal certo.
- Filmes (celular): a ordem "Recentes" entende a data do Xtream em segundos Unix (`features/catalog/addedAt.ts`, compartilhado com a Início).
- M3U: linhas `#EXTVLCOPT`/`#KODIPROP` entre o `#EXTINF` e o link não descartam mais o canal; `#EXTGRP` vale como grupo; o nome não é cortado por vírgulas dentro de atributos. O id do canal M3U passa a ser `tvg-id`/nome + hash do grupo e do link, e não muda quando o provedor reordena a lista (favoritos M3U salvos antes desta versão precisam ser marcados de novo uma vez). Download de M3U e XMLTV com tempo limite.
- XMLTV: leitura linear (antes recriava a lista do canal a cada programa), só 7 dias para trás e 2 à frente, hora formatada sem Intl e entidades numéricas (`&#233;`) decodificadas.
- Estado salvo: gravações no Keystore (SecureStore) agrupadas a cada 800 ms, ignoradas quando nada mudou e feitas em fila, sem terminar fora de ordem; descarregadas ao ir para segundo plano.
- EPG: lotes de 500 ms e fila limitada a 48 pedidos, descartando os canais que já saíram da tela.
- Cache do catálogo (SQLite, banco versão 4): índice `(server_id, kind)` para as páginas não ordenarem a tabela inteira; listas grandes gravadas numa área temporária e trocadas numa transação (`commitStaging`), sem meia lista se o app fechar no meio. Provedor só de filmes/séries também abre com o catálogo salvo.
- Player: buffer pelo perfil do aparelho (`services/deviceProfile.ts`, módulo nativo `ElvanoqDeviceProfile`): 32 MB em aparelhos de até 1,5 GB, 96–128 MB em aparelhos de 3 GB ou mais, o resto como antes. Ao vivo reconecta sozinho 3 vezes (3, 6 e 9 s) depois de erro de rede. O salvamento do progresso não recria mais os ouvintes do player. Credenciais com `@`, `+` etc. ganham uma última tentativa com o usuário/senha codificados na URL.
- Tela ligada: sempre na TV (como antes); no celular só enquanto o vídeo toca (removido `keepScreenOn` da activity).
- Início: destaques e trilhos calculados sem ordenar o catálogo inteiro; busca de Filmes, Séries e Ao vivo com `useDeferredValue`. Imagens do TMDB menores em aparelhos fracos.
- Removida a permissão sem uso `RECEIVE_BOOT_COMPLETED`. Build Android elevado para `20261051`.

## [2.17.32] — 2026-11-07

- Voltar nas seções principais (TV ao Vivo, Filmes, Séries e Ajustes): o protetor de saída (`RootExitGuard`, `app/_layout.tsx`) tratava essas rotas como raiz e mostrava "Deseja sair do aplicativo?". Agora leva à Início; só na Início o Voltar oferece sair (toque duplo + confirmação). Com o fim do menu lateral na 2.17.31, era o único caminho de volta na TV. Build Android elevado para `20261050`.

## [2.17.31] — 2026-11-07

- TV: removido o menu lateral (`components/tv-side-navigation.tsx`), como no Roku, na LG e no Samsung. A Início é o hub (TV ao Vivo, Filmes, Séries, Busca, Minha Lista, Ajustes) e Voltar em qualquer seção retorna a ela. As seções passam a usar a largura inteira da tela; some o foco que escapava para o menu ao apertar para a esquerda.
- TV: Ao vivo, Filmes e Séries são descarregados ao voltar à Início ou ir a outra seção (`components/tv-tab-eviction.tsx`), liberando grades, imagens e a prévia de canais da memória. Telas abertas por cima (player, detalhes, busca) não descarregam a seção, então Voltar encontra tudo como estava e a prévia do ao vivo continua (2.17.29). O catálogo segue na memória do app: a seção volta a montar sem baixar nada. Essas três seções deixam de ser congeladas na TV (o congelamento impediria o descarregamento); Início e Ajustes seguem congeladas.
- A prévia sai do registro de passagem para a tela cheia quando a seção é descarregada. Verificação de release atualizada para o novo comportamento. Build Android elevado para `20261049`.

## [2.17.30] — 2026-11-07

- Player ao vivo: com o OSD (controles) aberto, Voltar fecha o OSD; o guia e a confirmação também fecham primeiro. Com a tela limpa, Voltar retorna à lista de canais. Filmes e séries já fechavam o OSD com Voltar. Build Android elevado para `20261048`.

## [2.17.29] — 2026-11-07

- Ao vivo (TV): a tela cheia usa o mesmo player da prévia do guia (`features/live/live-preview-handoff.ts`). Com a prévia já tocando o canal escolhido, o canal abre sem recarregar e com um só decodificador ativo; ao apertar Voltar, a prévia continua no mesmo canal, do ponto em que está, sem recarregar. Depois de canal +/- em tela cheia, a lista volta com o canal que estava tocando selecionado. Se o canal for aberto antes de a prévia carregar, o comportamento é o de antes (player próprio).
- A seleção da prévia não é mais apagada ao sair da aba; a superfície de vídeo da prévia é recriada na volta para o player voltar a desenhar nela.
- Ao vivo (todas as versões): Voltar sai direto para a lista de canais, sem a confirmação de saída; com o guia aberto, Voltar só fecha o guia. Filmes e séries mantêm a confirmação.
- Player: removida a grade de canais (QuickSwitcher) e o botão "Abrir grade de canais", que pesavam na reprodução e não funcionavam bem; canal +/- e o guia continuam. Estilos sem uso removidos. Build Android elevado para `20261047`.

## [2.17.28] — 2026-11-06

Cache local do catálogo religado (desligado desde a 2.17.13, quando o registro do módulo nativo saiu do `MainApplication.kt`).

- Android: `CatalogDatabasePackage` registrado de novo. Módulo nativo completado com `append` (grava em partes) e `count`; leitura em ordem de gravação (`rowid`), que preserva a ordem do servidor e a numeração dos canais; IDs repetidos não derrubam a gravação. Banco na versão 3: qualquer arquivo de esquema antigo (de versões anteriores) é recriado, porque é só cache.
- Abertura rápida: com o catálogo completo salvo há menos de 6 horas, o app restaura canais, filmes e séries do banco local em vez de baixar a lista inteira. Depois de 6 horas, ou em "Atualizar" (Home, Diagnóstico), baixa do servidor como antes. Listas M3U continuam sempre pela rede.
- Gravação em partes de 1.500 itens, com pausa entre elas para a tela continuar respondendo; a falha ao salvar no banco nunca derruba a sincronização (o catálogo baixado continua na tela). A validade (`catalogSyncedAt:<id>`) só é gravada depois de ao vivo, filmes e séries salvos sem erro.
- Wrapper JS tolera qualquer versão do módulo nativo (métodos opcionais checados antes de chamar). Build Android elevado para `20261046`.

## [2.17.27] — 2026-11-06

- Busca geral (`app/search.tsx`): sem o banco local nativo (o `CatalogDatabasePackage` não é registrado desde a 2.17.13), a busca consultava um banco inexistente e nunca mostrava resultados. Agora, sem o banco, procura nos canais, filmes e séries já carregados, sem acentos e sem diferenciar maiúsculas, parando ao juntar a página pedida; o texto normalizado de cada item fica em cache.
- Sincronização (`hooks/useXtreamSync.ts`): as respostas brutas do servidor de ao vivo, filmes e séries ficam restritas ao trecho que as converte e são liberadas antes das gravações e da atualização da tela, reduzindo o pico de memória em listas grandes (Fire TV Lite, TVs de 1 GB).
- `catalogDatabase.count` não chama mais um método ausente do módulo nativo. Build Android elevado para `20261045`.

## [2.17.26] — 2026-11-06

- Login (TV e tablet deitado): a tela de ativação estava dimensionada para 1920 px, mas a TV Android trabalha com cerca de 960×540 dp, então a tela ficava grande demais e cortada. As medidas agora partem de 960×540 dp e escalam pelo tamanho real da janela (de 0,82× a 1,8×): logo, relógio, título, passos, MAC e chave, botões, QR e rodapé cabem inteiros, sem rolagem. Margens laterais em 5% da largura. Celular sem mudança. Build Android elevado para `20261044`.

## [2.17.25] — 2026-11-06

Correção de travamentos relatados em TV TCL (Android TV) no ao vivo e em filmes; vale para todos os aparelhos fracos.

- Player: buffer limitado (`bufferOptions`: 15 s à frente no ao vivo, 30 s em filmes/séries, até 48 MB na TV e 64 MB no celular, tamanho prevalece sobre tempo). O padrão do ExoPlayer chegava a ~128 MB só para vídeo, o que forçava coletas de memória e engasgos em TVs com 1–1,5 GB de RAM.
- Prévia de canais (guia da TV): ao abrir o player ou sair da aba, a fonte da prévia é liberada (`replace(null)`) em vez de só pausada. Antes ficavam dois decodificadores ativos ao mesmo tempo, e muitas TVs têm um só por hardware. Buffer da prévia limitado a 6 s / 12 MB.
- Retomada automática (2.17.21) só é armada depois que o vídeo começou a avançar e com limites maiores (20 s ao vivo, 30 s filmes/séries). Um servidor lento na abertura não é mais reiniciado em ciclo.
- Menos trabalho por segundo no player: com os controles ocultos, o tempo na tela é atualizado a cada 30 s no ao vivo e 5 s em filmes (episódios seguem a cada 1 s por causa de "Pular abertura" e da contagem do próximo episódio). Progresso salvo a cada 30 s (antes 10 s), cada gravação passa pelo armazenamento criptografado. Busca do canal atual memorizada. Build Android elevado para `20261043`.

## [2.17.24] — 2026-11-06

- Login (smartphone e tablet em pé): a sombra da tela de ativação cobria quase toda a arte de fundo. Agora escurece de leve no topo (5%), 35% no meio e 80% só no rodapé, e as ondas e o play voltam a aparecer. Build Android elevado para `20261042`.

## [2.17.23] — 2026-11-06

- Login (todas as versões): tela inicial no padrão da ativação do Roku e da LG (`features/login/activation-chooser.tsx`). Título "Ative sua TV" / "Ative este aparelho", três passos, MAC e chave do aparelho em destaque, "Entrar com código do servidor" como ação principal e atalhos "Xtream por Host" e "Listas salvas (N)". Status do vínculo com o Portal e versão no rodapé.
- TV e tablet deitado: QR code do Portal (`elvanoqplay.app/adicionar-lista/`, mesmo do Roku), relógio no canto superior direito no formato do Roku/LG ("10:42" e "Sexta, 6 nov") e sombra lateral sobre o fundo. Foco inicial em "Entrar com código do servidor" ou em "Listas salvas" quando há listas.
- Smartphone e tablet em pé: botão "Abrir o Portal" no lugar do QR, sem relógio.
- Nova logo `ELVANOQ_play_logo_tagline.png` (ELVANOQ Play — Sua mídia. Sua experiência.). Os formulários de código, Xtream e as Listas salvas não mudaram. Build Android elevado para `20261041`.

## [2.17.22] — 2026-11-06

- Ícone: novo ícone do ELVANOQ, o mesmo da edição Amazon (`elvanoq-play-amazon` 186a799). `ELVANOQ_app_icon_v4.png`, `ELVANOQ_adaptive_foreground_v4.png` e `ELVANOQ_adaptive_background_v3.png`; mipmaps do Android regenerados em todas as densidades e fundo do ícone adaptativo `#02070D`. A tela Sobre usa o mesmo ícone.
- Android TV/Fire TV: banner 320×180 (`drawable-xhdpi/banner.png`) declarado no manifest, mostrado na linha de apps da tela inicial da TV.
- Removidos os ícones antigos sem uso (`ELVANOQ_app_icon_v2/v3`, `ELVANOQ_adaptive_foreground_v3`). Build Android elevado para `20261040`.

## [Manutenção do repositório] — 2026-11-06

- Sem mudança no app (continua 2.17.21, build 20261039).
- Removidos ~150 arquivos `CHECKPOINT_*`, notas de versão e relatórios avulsos (2.10–2.17.13), a pasta `release/` de documentos da 2.15.0 e o `SYNC_GITHUB.sh` (sincronização de branch antiga). O histórico continua no Git e neste CHANGELOG, que passa a ser o único registro de mudanças.
- Removidos 13 imagens sem uso (splash, ícones e logos antigos do FlixPlay, versões v3/v4 do splash nativo), o `bun.lock` (o projeto usa npm), o `starter-subsets.json`, o `tools/patch_binary_manifest.py` e os módulos sem uso `services/githubUpdater.ts` (atualizações agora só pelo Portal) e `hooks/useScreenLoad.ts`.
- Documentos de build movidos para `docs/` (`ANDROID_COMPILER_ENVIRONMENT.md`, `BUILD_APK_UNIVERSAL.md`, `NODE_EXPO_OFFLINE_CACHE.md`, `RELEASE_GUARDRAILS.md`). README atualizado para a 2.17.21 (recursos, estrutura, build pelo GitHub Actions) e sem a seção obsoleta de atualização por GitHub Releases. APKs locais em `release/` ficam fora do Git.

## [2.17.21] — 2026-11-04

- Player (todas as versões): retomada automática. Se o vídeo para de avançar por 12 s no ao vivo ou 20 s em filmes/séries, a mesma fonte é reaberta no mesmo ponto, até 3 vezes seguidas; depois aparece o erro com "Tentar". Pausa do usuário e app em segundo plano não contam. Aviso "O sinal parou de chegar. Reconectando…".
- Ao vivo: com a preferência "Auto", o app lembra por lista qual formato abriu (HLS ou TS) e começa por ele nos próximos canais e na troca de canal (`liveFormat:<serverId>`). A escolha manual do usuário continua valendo.
- Rever programas: o player tenta três formatos de arquivo Xtream (`/timeshift` com horário em segundos, `/timeshift` com data e `/streaming/timeshift.php`) antes de mostrar "Este programa não está disponível para rever"; não cai mais para o ao vivo em caso de falha.
- Controle parental: proteção automática de conteúdo adulto (ligada por padrão). Categorias com nomes como Adultos, XXX, +18 e Eróticos pedem o PIN sem configuração; podem ser liberadas uma a uma (exceção gravada na lista de bloqueios do servidor). Selo "Automática" na lista e contagem de protegidas considera a regra.
- Nova tela Ajustes > Categorias visíveis (celular, tablet e TV): oculta categorias de Ao vivo, Filmes e Séries por lista, sem apagar nada. As categorias ocultas somem dos chips, de "Todos" e do navegador da TV.
- Player (Android): atalho "Abrir em outro player" na barra superior, com o formato que está funcionando. Build Android elevado para `20261039`.

## [2.17.20] — 2026-11-02

- Visual premium unificado (smartphone, tablet e TV): as telas secundárias seguem o padrão da tela Sobre, com brilho azul no topo, botão Voltar circular com título centralizado, cabeçalho com ícone e opções em grupos com rótulos discretos. Novo componente compartilhado `components/premium-screen.tsx` (fundo, barra, cabeçalho, grupos, linhas e botões com foco de controle remoto).
- Controle parental: cartões de desbloqueio e troca de PIN no novo estilo, campo de PIN com dígitos espaçados e só números, contagem de categorias protegidas no topo, áreas (Canais, Filmes, Séries) como grupos expansíveis com selo "Bloqueada/Livre" e ações de PIN agrupadas.
- Player: preferências agrupadas (Reprodução, Comportamento, Avançado) com seletores segmentados; "Modo Android TV" aparece desativado quando detectado automaticamente.
- Diagnóstico: resumo com totais de canais, filmes e séries; Conexão, Aparelho, Ações e Armazenamento agrupados; "Reconstruir banco local" destacado como ação destrutiva.
- Adicionar lista: seletor segmentado Xtream Codes/M3U, campos agrupados (Lista e Acesso) e botão "Importar lista" para M3U.
- Ajustes, Assistir Mais Tarde e Continuar Assistindo: mesmo fundo da tela Sobre e botão Voltar padronizado; na TV, cartões de Ajustes com a nova paleta.
- Busca: respeita a barra de status (antes ficava por baixo dela), fundo premium e, em tablet e TV, coluna central com largura máxima. Build Android elevado para `20261038`.

## [2.17.19] — 2026-11-01

- Sobre (smartphone, tablet e TV): tela redesenhada no padrão premium das demais. Destaque com o ícone do app, nome, slogan e versão; cartão único de Atualizações com o resultado da última verificação na própria tela (sem alertas), botão "Verificar atualizações" e opção "Verificar ao abrir o app"; novidades da versão atual em lista, com a anterior sob demanda; recursos em grade (2 colunas no celular, 4 no tablet deitado e na TV); informações agrupadas (versão, aparelho, distribuição) e link para elvanoqplay.app. Tablet e TV ficam centralizados com largura máxima.
- Sobre: corrigidos o logotipo que vazava do quadro do ícone, o selo "Verificação manual" cortado, a seção "Ajuda e transparência" vazia e a informação de verificação repetida.
- Login (smartphone, tablet e TV): novo fundo do Roku 1.0.1 — ondas de luz azuis e o símbolo de play no lugar da parede de pôsteres. Na TV e no tablet deitado, a arte ocupa a tela; no celular e no tablet em pé, a composição foi refeita na vertical, com a arte por trás do cartão de acesso.
- Aviso de atualização (TV): botões "Atualizar agora", "Cancelar", "Depois" e "Ver todas as novidades" ganharam foco visível no controle remoto. Durante o download, o botão Voltar não fecha mais a janela (use "Cancelar"). Build Android elevado para `20261037`.

## [2.17.18] — 2026-11-01

- Atualizações: o aviso automático do Portal ELVANOQ Play foi compactado para uma apresentação mais premium. Ele mostra a versão instalada e a nova versão, tamanho do APK e até dois destaques; o changelog completo só é exibido quando solicitado.
- Atualizações: botões, progresso de download, cancelamento e navegação por controle remoto foram preservados. Build Android elevado para `20261036`.

## [2.17.17] — 2026-10-31

- Correção (desempenho em Fire TV Stick Lite e 1ª geração): navegação pelo controle voltou a responder rápido.
  - Início: o carrossel do destaque passou a ser um componente isolado. Rotação (a cada 8 s), foco nos botões e confirmação de "Minha Lista" não redesenham mais todas as fileiras. Entrar/sair de foco entre os botões do destaque gera uma única atualização.
  - Início (TV): sem fundo desfocado e sem aproximação lenta da arte; transição da imagem mais curta. Progresso da sincronização atualiza só o banner, não a tela inteira.
  - Pôsteres (TV): fundo sólido, sem degradês e sem animação de entrada da imagem; cartões não são redesenhados quando outros dados da tela mudam (guia, sincronização).
  - Filmes/Séries (TV): o rodapé com o título em foco se atualiza sozinho; painel de categorias e grade não são mais redesenhados a cada tecla. Pôsteres sem animação de entrada.
  - Textos: caminho rápido quando não há estilo próprio.
- Correção (desempenho): o agrupamento de versões e a limpeza de títulos usavam várias expressões regulares por título e eram recalculados sobre o catálogo inteiro (dezenas de milhares de itens) ao abrir Filmes/Séries, trocar de categoria, buscar e abrir Detalhes. No Hermes isso travava a interface por segundos — toques, categorias e barra de abas sem resposta. Agora as chaves são calculadas com operações simples de texto, ficam em cache por título, são preparadas em lotes em segundo plano (a lista aparece na hora e o agrupamento entra em seguida) e o índice de versões dos Detalhes é montado uma única vez.
- Agrupamento mais preciso: "Leg Day" não é mais tratado como legendado e "Duna (Parte Dois)" não é mais agrupado com "Duna".
- Filmes e Séries (smartphone/tablet em pé): cabeçalho compacto — título com total, busca em campo único, uma linha de categorias e "Ordenar" recolhido; atualizar passa a ser puxar a lista para baixo. O conteúdo aparece logo no topo. Séries deixa o vermelho e adota a cor do app; sem "Temporadas não informadas" (mostra ano e categoria); busca descreve o que realmente faz.
- Títulos e categorias limpos em todo o app: "Devorador [L]" vira "Devorador", "Filmes | Mais Assistidos" vira "Mais Assistidos" e "Drama |" vira "Drama". Totais com separador de milhar (31.904).
- Versões agrupadas: dublado, legendado e nacional do mesmo título (mesmo nome e ano) aparecem como um único cartão em Filmes, Séries, Início e na TV; a versão é escolhida nos Detalhes (seletor "Versão" em celular, tablet e TV).
- Pôster limpo: a nota saiu de cima da arte e foi para a linha de dados, como nos serviços de streaming. Chip "Minha Lista" corrigido (ícone ao lado do texto).
- Textos: a fonte ampliada do sistema é respeitada até 1,3×, evitando títulos quebrados em botões e cartões; legendas pequenas não herdam mais a altura de linha do corpo de texto.
- Ajustes (smartphone/tablet): estilo agrupado — cartão da conta no topo (status, validade, conexões), listas sem endereço e com um único indicador de ativa, exclusão no modo "Editar", seções com rótulos discretos e linhas agrupadas.
- Login: ícone de chave para "Código do servidor", títulos sem quebra, logotipo mais compacto e cartão "Este aparelho" com MAC e chave em uma linha (selecionáveis) e situação do Portal.
- Design (TV, smartphone e tablet): cartões de pôster no padrão dos serviços de streaming — cantos de 12 dp, degradê inferior, selos de qualidade e nota refinados, arte provisória com o título enquanto a imagem carrega (ou quando o servidor não envia pôster) e, na TV, foco desenhado só no pôster com ampliação e sombra.
- Design: cabeçalhos de fileira com título mais firme e "Ver todos" em pílula com foco próprio; botões de ícone translúcidos com foco ampliado; estados de vazio e erro com ícone em degradê; carregamento com esqueletos de pôster pulsando no lugar do indicador isolado.
- Canais: logotipos aparecem inteiros e nítidos (antes esmaecidos com iniciais por cima); as iniciais ficam só para canais sem imagem. Vale para Início, TV ao Vivo no celular e demais listas.
- Barra de abas (smartphone/tablet): aba ativa em branco com ícone preenchido e inativas em contorno, fundo mais sólido.
- Tablet na horizontal: Filmes, Séries e Detalhes passam a usar o formato do Roku adaptado ao toque — painel de categorias, grade com título sob cada pôster, botão Voltar nos Detalhes, áreas seguras e alvos de toque maiores. Tablet em pé e smartphone mantêm o layout anterior.
- Login: ao escolher uma lista salva, o carregamento e as mensagens de erro agora aparecem na tela de métodos (antes ficavam invisíveis). Na TV, o foco inicial vai para Listas Salvas quando há listas e, no painel, direto para a lista ativa. No celular, a tela rola até a mensagem de erro quando o teclado a cobre. Tablet na horizontal usa o fundo largo, como a TV.
- Ajustes: Host/DNS deixou de ser exibido nas listas (mesma regra das Listas Salvas e do Roku), com código, usuário mascarado e validade no lugar. Status da lista traduzido e colorido conforme a situação (verde só quando ativa), validade e conexões em uso/limite. Na TV, cartão da conta no topo. "Atualizar lista" não abre mais um alerta. No tablet, conteúdo centralizado com largura limitada.
- Adicionar servidor: mesma validação do Login — conta expirada ou bloqueada é recusada, validade e conexões são salvas, e erros de rede usam as mensagens amigáveis.
- Android edge-to-edge: Ajustes, Preferências do player, Controle parental, Diagnóstico, Sobre, Adicionar servidor, cabeçalhos de Filmes/Séries e controles dos Detalhes respeitam a barra de status em smartphone e tablet.
- Filmes e Séries (Android TV, Google TV e Fire TV): navegação no formato do ELVANOQ Play para Roku. Painel de categorias com contagem de títulos (Buscar título ou ator, Minha Lista, Todas e as categorias na ordem da lista), grade de pôsteres em 6 colunas que muda ao parar sobre uma categoria e rodapé com título, ano, duração/temporadas, categoria e nota do item em foco. Smartphone e tablet sem alteração.
- Busca por ator (TV): "Buscar título ou ator" consulta a filmografia no TMDB e mostra os títulos dela que existem na lista, junto com os resultados pelo nome.
- Detalhes (TV): tela no formato do Roku — fundo com a arte larga, pôster emoldurado à direita, Detalhes • Filme/Série, título, avaliação, data de lançamento, até quatro gêneros, sinopse, elenco, ações Assistir/Continuar, Minha Lista, Trailer e bloqueio parental, linha de status, temporadas em abas com episódios em cartões 16:9 e "Mais como este".
- TMDB com as regras do Roku: pôster w780 e fundo w1280, título e data do TMDB, até quatro gêneros, trailer somente HTTPS e recomendações cruzadas com a lista. A correspondência agora considera o ano; título e imagens do TMDB só substituem os da lista quando título e ano conferem. Séries Xtream continuam com temporadas e episódios do servidor. Cache do TMDB renovado (v2).
- Início (Android, Android TV, Google TV e Fire TV): tela reconstruída no formato de hub do ELVANOQ Play para Roku 0.1.88. Destaque de ponta a ponta com marca e conta sobre a arte, rótulo editorial, nota, qualidade, metadados, sinopse e as ações **Assistir agora**, **Minha Lista** (adiciona/remove na hora, com confirmação) e Detalhes. Ordem dos destaques igual à do Roku: Destaque da semana, Recém-adicionado e Mais bem avaliado (filmes e séries), com retornos para Continue assistindo e Destaque ELVANOQ. Rotação a cada 8 s, pausada com foco nos botões ou fora da Início.
- Início: blocos de navegação (TV ao Vivo, Filmes, Séries, Busca, Minha Lista e Ajustes) com contagem do catálogo, exibidos em TV e tablet na horizontal. No smartphone eles não aparecem, pois a barra de abas já cumpre esse papel; a Busca ganhou um botão próprio no topo da Início. Em TV o menu lateral deixa de aparecer na Início, como no Roku; nas demais seções ele permanece, e Voltar retorna à Início com o foco no bloco de origem.
- Início: fileira principal com os mesmos retornos do Roku (Continuar assistindo → Seus favoritos → Novidades para você), seguida de Minha Lista, Canais ao vivo, Filmes adicionados recentemente (agora pela data real de inclusão) e Séries mais bem avaliadas.
- Acabamento: luz ambiente a partir da arte do destaque, transição suave e aproximação lenta da arte, indicador de progresso da rotação (tocável no celular), Continuar assistindo com tempo restante e canais com selo Ao vivo.

## [2.17.16] — 2026-10-29

- Login Android: o campo Código deixou de reescrever o texto no mesmo evento da digitação e não monta o botão de limpar em smartphone/tablet após o primeiro caractere. A normalização para minúsculas e remoção de espaços ocorre ao conectar. Build elevado para `20261034`.
- Login Android: eliminada a atualização de handles D-Pad durante o redimensionamento pelo teclado em smartphone/tablet. Os handles e foco preferencial agora sequer são enviados aos campos fora de TV. Build elevado para `20261033` para garantir a instalação desta correção sobre o APK anterior.
- Login Android: corrigido encerramento ao focar o campo Código. O formulário deixa de recriar o `BlurView` nativo enquanto o teclado abre, usa redimensionamento estável da janela e aplica atributos de D-Pad somente em TV.
- Splash Android: adotado o novo símbolo branco transparente, centralizado e proporcional, sobre o fundo nativo `#03070f` em smartphone, tablet, Android TV, Google TV e Fire TV.
- Splash Android: os recursos nativos agora usam a área recomendada de `108dp` em cada densidade, derivados do PNG mestre de alta resolução. Isso evita a ampliação do bitmap pelo SplashScreen do Android e mantém o símbolo nítido.
- Build Android: elevado para `20261032`, permitindo instalar a correção do atualizador por cima do APK 2.17.16 publicado anteriormente.
- Atualizações: corrigida a classificação de respostas HTTP 200 do Portal. Uma release válida não é mais exibida indevidamente como indisponível.
- Atualizações: substituída a consulta e o download via GitHub Releases pela distribuição oficial do Portal ELVANOQ Play. O app consulta somente a release publicada, evita downgrade e confere tamanho e SHA-256 do APK antes de abrir o instalador Android, com progresso e cancelamento.

- Qualidade: ampliada a cobertura dos fluxos de Portal para Código (403/404/429/503), sincronização de lista M3U, bloqueio explícito e migração legada sem envio de credenciais. Incluídos testes de validação do login e da normalização de episódios.
- Arquitetura: regras puras de Login, parsing de episódios de Detalhes e navegação de episódios do Player foram movidos para módulos próprios, preservando as telas e reduzindo o risco de regressão em arquivos extensos.
- Performance: adicionado roteiro de teste físico sanitizado para Fire TV/Fire Stick com catálogo grande, troca de categorias, preview, retorno do player e fluxo de série.

- Player: séries agora avançam para o próximo episódio ao terminar, após uma contagem visível de seis segundos e com ação explícita para cancelar. A ação manual de próximo episódio foi preservada em TV, tablet e smartphone.
- Player: “Pular abertura” deixou de usar uma estimativa fixa. O botão só aparece quando o provedor entregar o marcador explícito `intro_end_seconds`/`introEndSeconds`, evitando saltos indevidos em episódios sem marcação.

- Portal: centralizado o transporte público de `portal-control` para os fluxos de Código, status do dispositivo, sincronização de listas e migração. Limites de requisição (429), indisponibilidade temporária (502/503/504) e falhas de rede agora têm tratamento consistente, sem serem confundidos com bloqueio de licença.

- Login: o rodapé de identidade agora informa claramente o endereço de cadastro `elvanoqplay.app`, preservando MAC, chave e estado do Portal.

- Responsividade: Listas Salvas deixa de ocupar a tela inteira em TV e tablet. O painel agora usa largura/altura limitadas, ações proporcionais em linha e lista com rolagem interna; no smartphone, o painel inferior foi preservado.
- Responsividade: cadastro manual de servidor e Diagnóstico agora centralizam conteúdo e limitam a largura em tablet e TV, evitando formulários, linhas e controles excessivamente esticados.
- Portal: links externos do aplicativo foram centralizados em `https://elvanoqplay.app`. Listas Salvas agora oferece acesso ao gerenciamento no Portal; endpoints Supabase, QR Codes Pix e hosts IPTV não foram alterados.
- Portal: licenciamento por Host/DNS aplicado também a listas M3U e Xtream sincronizadas. As listas mantêm seu tipo original, consultam `license-status` com MAC/chave antes do uso e nas revalidações, preservam cópia local em bloqueios e não registram códigos novamente.
- Controle parental: registrado o módulo seguro Android no aplicativo e adicionada recuperação com tempo limite; a tela não permanece mais indefinidamente em “Verificando armazenamento seguro”.
- Portal: a reativação explícita de um dispositivo pendente pelo responsável agora confirma o vínculo de migração; nenhuma licença, período de teste ou cobrança é alterado nesse processo.
- Migração de instalações anteriores: após restaurar o estado local, o app registra a identidade no Portal em segundo plano, sem alterar listas, sessão, favoritos, histórico ou progresso. O Portal confirma somente o mesmo MAC/chave, não recebe credenciais/listas e não cria testes, licenças ou cobranças. Casos sem comprovação ficam pendentes de regularização administrativa, com repetição segura e progressiva.

- Bloqueio por Código: corrigidos os botões de verificação e retorno ao login. O retorno encerra somente a sessão ativa do código, preserva a lista salva e não deixa a camada de bloqueio sobreposta ao login. A nova verificação agora informa quando a restrição persiste.

- Login por Código: o Host/DNS retornado pelo Portal agora mantém estritamente o protocolo e a porta configurados. Conexões HTTP não sofrem mais tentativa automática de HTTPS. O diagnóstico separa resolução do código, autenticação Xtream e carregamento de catálogo, sem registrar credenciais.

- Acesso por código e dispositivo: validação de licença vinculada ao MAC/chave persistente, revalidação ao retornar ao app e a cada cinco minutos em primeiro plano, bloqueio global e encerramento seguro do player quando houver negativa explícita. Incluído fluxo Pix PagHiper com QR Code, Copia e Cola, consentimento, sessão segura e confirmação somente pelo servidor.

- Login: removido o atalho de conexão M3U da tela inicial para simplificar o acesso. “Listas Salvas” agora fica dentro do mesmo card dos métodos de conexão, com contador e acesso à sincronização do Portal. O suporte e as listas M3U já salvas foram preservados.

- Login Xtream por código: nova modalidade com Código, Usuário e Senha. O código é normalizado e resolvido no Portal antes da autenticação Xtream, sem enviar credenciais IPTV à Edge Function. Conexões por código atualizam o DNS a cada reconexão e preservam uma única Lista Salva por código; Xtream por Host e M3U permanecem disponíveis.

- Controle parental: bloqueios por categoria agora seguem Canais, Filmes e Séries até o player. O PIN é solicitado antes da reprodução mesmo quando o catálogo foi carregado por paginação e o item não está no cache em memória.

- Portal: sincronização segura de listas M3U e Xtream cadastradas no Portal ELVANOQ Play. A lista é obtida somente após validação de MAC + chave, é adicionada/atualizada em Listas Salvas sem duplicar, sem trocar a lista ativa e permanece disponível offline. Incluído fluxo explícito para informar a chave gerada pelo Portal quando o primeiro cadastro foi feito sem a chave do aplicativo.

- Controle parental: primeiro acesso agora valida o PIN padrão 0000 e, após a confirmação, libera as categorias de Canais, Filmes e Séries. Implementada a troca segura de PIN e a restauração opcional ao padrão 0000.

- Login: MAC, Chave do dispositivo e estado do Portal agora são exibidos como texto branco simples, sem card, borda, fundo ou ícone em TV, smartphone e tablet.

- Metadados de release alinhados para 2.17.16 / Android versionCode 20261031.

- Player: restaurado app/player.tsx como fonte TypeScript UTF-8 válida após corrupção do blob no repositório. Foram preservados controles de reprodução, OSD, EPG, troca rápida, retomada, favoritos, PiP e bloqueios parentais por conteúdo e categoria.

- Portal: integrado o vínculo do identificador local do dispositivo. O app consulta em segundo plano o par MAC/Chave cadastrado no Portal e informa o estado do vínculo, sem iniciar teste, cobrança, pagamento ou bloqueio de acesso.
- Login: incluídos identificadores locais do aparelho — Endereço MAC no formato de ativação e Chave do dispositivo. Na TV ficam no canto inferior direito; em smartphone e tablet, no rodapé. Esta etapa não possui cobrança, ativação remota ou comunicação com serviços de pagamento.
- Controle parental: após validar o PIN, a tela passa a apresentar Canais, Filmes e Séries em seções expansíveis. Cada categoria possui cadeado individual para bloquear ou liberar, com estado persistido separadamente para cada servidor. A proteção de categoria também é validada pelo player, inclusive durante a troca de canais.
- Menu lateral TV: largura do drawer expandido reduzida de 232 px para 176 px, removendo o espaço vazio à direita sem alterar o rail recolhido ou a navegação por D-Pad.
- Sobre: removida da interface a identificação e o endpoint do repositório de atualizações; o cartão agora mostra somente “Atualizações via GitHub Releases”, sem alterar a verificação interna.
- Início: hero passou a alternar de forma fluida entre Recém-adicionado, Destaque da semana e Mais avaliado. A rotação usa somente o catálogo já carregado, é pausada quando os botões recebem foco na TV e exibe sinopse de até três linhas nesse modo.
- Início: hero unificado em TV, smartphone e tablet com imagem limpa no topo e degradê escuro progressivo de baixo para cima, preservando leitura dos títulos e botões.
- Início: a lupa de pesquisa foi substituída por um resumo compacto da conta em TV, smartphone e tablet. O bloco exibe avatar por inicial, nome da lista ou usuário e data de expiração; ao selecioná-lo, abre Ajustes.

## [2.17.15] — 2026-10-18

### Interface TV proporcional

- Tablet: criada classificação responsiva centralizada para retrato e paisagem. Home, Filmes, Séries, TV ao Vivo, Detalhes, Login e Assistir Mais Tarde passam a usar grades, margens, hero, cards de episódios e limites de conteúdo apropriados para telas entre smartphone e TV.
- Correção de foco: superfícies brancas agora preservam integralmente o fundo branco ao receber foco na TV; removida a transparência e a elevação genéricas que escureciam botões no Android TV e Fire TV.
- Estabilidade de detalhes: abertura de filmes e séries deixa de alocar uma cópia do catálogo inteiro para recomendações; requisições de episódios são canceladas ao trocar de tela e os enriquecimentos opcionais (sinopse/TMDB) ocorrem após a navegação e de forma sequencial, reduzindo travamentos e risco de encerramento em dispositivos com pouca memória.
- Menu lateral TV: segunda reconstrução estrutural para Fire TV. Os botões de ícone passaram a ter árvore fixa e independente; rótulos e fundo expandido são uma camada visual não focável. O D-Pad vertical não executa atualização de estado, redimensionamento, opacidade ou nova montagem.
- Menu lateral TV reconstruído: rail fixo de 64 px com ícones de 12 px e drawer opaco de 232 px sobreposto ao conteúdo. A abertura não redimensiona a tela, os itens permanecem montados e os rótulos são revelados somente por largura, eliminando a causa anterior de desaparecimento durante a navegação.
- TV ao Vivo: espaçamento entre as três colunas foi reduzido para ampliar a área útil de nomes e conteúdos; a lista de canais agora oferece coração focável ao lado do nome para adicionar/remover favoritos.
- Menu lateral TV: removidos o acabamento glass, transparências e sombra de foco. O rail agora usa degradê opaco escuro da esquerda para a direita, reduzindo a recomposição da cena no Fire TV.
- Menu lateral TV: removidos o ícone e a marca ELVANOQ do cabeçalho; os destinos de navegação passam a permanecer centralizados verticalmente no rail.
- Menu lateral TV: ícones reduzidos para 18 px, mantendo a área de foco de 42 px para controle remoto confortável e visual mais minimalista.
- Menu lateral TV refinado: ícones usam desenho `outline` consistente, estados mais leves e área de foco confortável, reduzindo o peso visual e aproximando a navegação do padrão de apps de streaming.
- Menu lateral TV: o rail recolhido agora ocupa somente a largura dos ícones e expande somente ao receber foco. Rótulos são ocultos por recorte de layout, sem opacidade, para evitar que Fire TV deixe itens intermediários sem renderização.
- Smartphone: o seletor de temporada passou a expandir a lista diretamente na tela de detalhes, sem abrir modal; episódios passaram a usar cards horizontais com rolagem lateral.
- Refatoração estrutural: painéis de categorias e preview/EPG da TV ao Vivo foram isolados do controlador da tela; busca e cache de sinopse foram isolados da tela de detalhes. O comportamento visual, de D-Pad e de smartphone foi preservado.
- Auditoria técnica: removidos componente de hero sem importação, dados de demonstração não utilizados e três fundos de login substituídos, reduzindo código e assets sem função no pacote.
- Tela de login atualizada com os novos backgrounds fornecidos: composição em 16:9 para TV e retrato para smartphone, otimizadas para carregamento sem alterar o fluxo de autenticação.
- Home TV foi reorganizada no padrão editorial de streaming: hero sem card, imagem de ponta a ponta, informações sobre o backdrop e fileiras mais próximas ao conteúdo principal.
- O Destaque da Semana passa a selecionar o filme recentemente adicionado com melhor avaliação e mantém a escolha por sete dias; após o período, alterna para o próximo candidato elegível.
- Menu lateral TV recebeu ícones de 22 px, linhas proporcionais e barra ativa compatível com a nova densidade visual.
- Botões azuis de ação em login/recuperação, conexão de servidor, controle parental, atualização, sincronização de catálogo e saída do player foram unificados à superfície branca; o azul permanece reservado para foco, seleção, progresso e indicadores.
- O foco padrão de D-pad passa a preservar a cor original da superfície do controle, evitando que botões brancos fiquem azuis ou escuros ao receber foco.
- Botões de ação em Filmes e Séries foram unificados no acabamento claro de “Assistir agora”; Trailer, Bloquear e Mais tarde mantêm texto e ícones escuros, inclusive quando recebem foco na TV.
- O seletor expansível de temporada na TV e suas opções passam a usar superfície branca, sem sobreposição escura sobre as ações.
- Smartphone: a seleção de temporada das séries passa a abrir em painel inferior, substituindo a faixa extensa de botões por uma lista clara, selecionável e fechada após a escolha.
- Smartphone: episódios receberam cards mais refinados, com thumbnail 16:9 compacta, título, sinopse, duração, estado de novo e progresso de reprodução.
- Smartphone: escala da área de episódios foi ajustada para leitura confortável e densidade equivalente a aplicativos de streaming premium.
- Detalhes de séries na TV passam a usar seletor de temporada expansível, com opções fechadas após a escolha e episódios atualizados na mesma tela.
- Hero, título, metadados, ações, cards de episódios e recomendações foram compactados para uma hierarquia de streaming proporcional.
- Menu lateral TV passou a manter uma área de foco com largura fixa. A navegação vertical não redimensiona mais itens, rótulos ou o contêiner; somente a camada visual do rail abre e recolhe ao entrar/sair do menu.
- Tela Inicial TV com hero mais compacto e fileiras de conteúdo mais próximas da primeira área útil.
- Grades de Filmes e Séries com 6/7/9 pôsteres conforme a largura da TV, reduzindo cards excessivamente grandes.
- Títulos de hero e detalhes alinhados a uma escala de leitura mais equilibrada para TV.
- TV ao Vivo com três painéis proporcionais: categorias, lista de canais e preview/EPG; a coluna de canais segue a mesma superfície visual das categorias.
- Menu lateral mantém rótulos estáveis durante a navegação vertical pelo D-pad.

### Versão

- Versão do aplicativo: `2.17.15`.
- Build Android: `20261030`.

## Correções em preparação — base 2.17.14

- TV: Tela Inicial recebeu hero mais compacto e fileiras mais densas; grades de Filmes e Séries exibem mais pôsteres por linha, reduzindo o tamanho excessivo dos cards. TV ao Vivo equilibra as três colunas e padroniza a superfície da lista de canais com a de categorias.
- Menu lateral TV: a movimentação vertical não atualiza mais o estado do contêiner nem trata o mesmo D-pad duas vezes. O rail só abre ao receber foco e só recolhe na saída explícita pela direita, mantendo todos os itens legíveis durante a navegação no Fire TV.
- Rail lateral da TV passa a manter marca, rótulos e versão permanentemente montados; o D-pad vertical não pode mais ocultar informações entre itens. A saída explícita pela seta direita continua recolhendo o menu.
- Menu lateral TV deixa de recolher por eventos transitórios de blur entre itens: todos os rótulos permanecem visíveis durante a navegação vertical e o rail recolhe somente ao sair para o conteúdo com a seta direita.
- Corrigida a passagem de tvMode para a faixa de recomendações na tela de detalhes, evitando erro de propriedade inexistente em filmes e séries.
- Corrigida duplicidade de parâmetro na tela de detalhes que impedia o bundle de filmes e séries no GitHub Actions.
- Detalhes de filmes e séries na TV receberam composição editorial inspirada em serviços premium: hero ampliado, informações e ações proporcionais, episódios em faixa horizontal e recomendações em cards de paisagem. A experiência de smartphone foi preservada.
- Menu lateral da TV mantém o rail expandido durante a transferência de foco entre itens no Fire TV; rótulos, marca e versão não somem mais durante a navegação por D-pad e o menu continua recolhendo ao sair dele.
- Splash nativo Android passa a usar somente o símbolo transparente em alta definição; removido o quadrado escuro incorporado que deixava a abertura borrada e desproporcional.
- Ajustes recebeu apresentação específica para TV com grade compacta de duas colunas; no smartphone, a navegação em lista foi preservada com espaçamento e cartões mais proporcionais.
- Menu lateral TV passa a recolher para ícones quando o foco sai dele e expande com marca, rótulos e versão ao receber foco, no padrão de Netflix, YouTube e Prime Video.
- Menu lateral da TV removido da camada sobreposta: ele passa a ocupar uma coluna fixa do layout, impedindo que cenas nativas do Fire TV ocultem ícones e textos.
- Ícone do aplicativo e marca da abertura redimensionados e centralizados com área segura para launchers Android, Android TV, Google TV e Fire TV.
- A tela de login passa a usar os valores centralizados de versão e build como reserva, evitando a exibição de dados antigos quando as informações nativas não estiverem disponíveis.

- Preview da TV ao Vivo mantido visível durante paginação/sincronização e renderizado em `TextureView` para composição estável em Android TV, Google TV e Fire TV.
- Navegação por canais otimizada: a troca do preview aguarda a estabilização do foco e o EPG na TV é carregado apenas para o canal selecionado.
- Menu lateral da TV recolhe logo após o foco sair do rail, sem permanecer sobre categorias e canais.
- Correção adicional após homologação em Fire TV Stick: linhas de canal TV não instanciam mais `BlurView`; contagens de categoria são calculadas uma única vez por catálogo e o painel de preview permanece estruturado na tela.
- Menu lateral TV estabilizado após nova homologação: a barra passa a ocupar 216 px fixos, com ícones, textos e versão sempre visíveis, sem expansão sobre o conteúdo.
- Detalhes de filmes e séries na TV receberam escala compacta: hero menor e ações, metadados, temporadas e episódios retornam à primeira área útil da tela.

## [2.17.14] — 2026-10-15

### Mais estabilidade nas atualizações

- Processo de geração do aplicativo Android aprimorado para tornar as atualizações futuras mais confiáveis.
- Verificações do ambiente de compilação foram reforçadas para identificar pendências antes de gerar o APK.
- Preparação de dependências locais e do Gradle otimizada, reduzindo riscos de falhas durante a criação de novas versões.
- Mantida a experiência atual do ELVANOQ em Android, Android TV, Google TV, Fire TV e Fire Stick.

### Versão

- Versão do aplicativo: `2.17.14`.
- Build Android: `20261029`.
- APK universal preparado para `arm64-v8a` e `armeabi-v7a`.

## [2.17.13] — 2026-10-14

### Guia TV responsivo e áudio controlado

- Guia TV ao vivo reestruturado em dois painéis reais: lista de canais compacta à esquerda e preview/EPG à direita, sem sobreposição entre as áreas.
- Tipografia TV ajustada para título de canal em 14 px e EPG em 10 px, preservando uma escala confortável em 720p e 1080p.
- Preview de canal agora pausa quando a guia TV ao vivo perde foco, eliminando áudio residual ao navegar para Início, Filmes, Séries ou player.
- Janela de foco do menu lateral TV ampliada para evitar que ícones e rótulos recolham durante a troca rápida pelo controle remoto.

## [2.17.12] — 2026-10-14

### Navegação de TV e guia ao vivo

- Corrigido o menu lateral para manter ícones e rótulos visíveis durante mudanças rápidas de foco pelo controle remoto.
- Rail lateral refinado com largura menor, ícones e tipografia proporcionais e expansão retrátil mais estável.
- Guia de TV ao vivo recebeu ajustes de densidade e espaçamento para melhor aproveitamento de telas grandes.

### Compatibilidade e validação

- Compatível com Android, Android TV, Google TV, Fire TV e Fire Stick.
- APK universal para `arm64-v8a` e `armeabi-v7a` validado com assinatura APK Signature Scheme v2.
- TypeScript validado, build Android nativo concluído e 113 testes automatizados aprovados.

## [2.17.11] — 2026-10-13

### TV refinada e guia ao vivo responsivo

- Menu lateral da TV agora segue o padrão retrátil: ícones compactos fora do foco e rótulos completos ao navegar pelo controle, sem desaparecimento entre itens.
- Tela Inicial da TV recebeu hero mais cinematográfico, hierarquia de conteúdo mais nítida e fileiras com escala adequada para telas grandes.
- Guia TV ao vivo foi redesenhado em duas colunas responsivas, com lista compacta de canais, preview ampliado e programação Agora/Próximo.
- O preview do canal focado passa a reproduzir áudio, mantendo o canal selecionado como prioridade sonora.

## [2.17.10] — 2026-10-13

### Glass Blur e release nativo

- O blur nativo permanece restrito às superfícies Glass: card de login, barra de navegação, miniplayer e menu lateral da TV.
- Fundos opacos que escondiam o blur foram substituídos por transparência controlada, mantendo contraste e legibilidade.
- Release recompilado nativamente a partir do código-fonte, com a configuração de produção do TMDB incluída apenas durante o build.

## [2.17.9] — 2026-10-13

### Glass e blur Android

- Blur nativo Android habilitado nas superfícies Glass para produzir desfoque visível do conteúdo ao fundo.
- Opacidade das camadas Glass refinada para um acabamento mais leve, premium e próximo à referência Apple TV.
- Login, navegação inferior, miniplayer e elementos compartilhados de interface atualizados.

## [2.17.8] — 2026-10-13

### Experiência premium TV e smartphone

- Rodapé da tela de acesso agora exibe versão e build do aplicativo em smartphone e TV.
- Telas de detalhes de filmes e séries passam a usar pôster full-bleed, com degradê escuro e topo visualmente limpo.
- Superfícies Glass receberam blur mínimo de 60%, preservando legibilidade e profundidade.
- Tela Inicial da TV foi refinada com navegação lateral compacta, ícones discretos, foco claro e hero cinematográfico mais denso.
- Escala tipográfica e espaçamentos da TV foram ajustados para um visual mais delicado e confortável em telas grandes.

## [2.17.7] — 2026-10-12

### Refinamento Premium TV e smartphone

- Menu lateral da TV agora usa superfície opaca, sem o conteúdo da tela vazar sobre as opções.
- Navegação lateral mantém ícones e rótulos legíveis durante a troca de foco e volta ao modo compacto somente fora do menu.
- A opção focada no menu TV passa a usar fundo branco e conteúdo escuro, alinhada ao padrão visual de “Assistir agora”.
- Controles brancos preservam o fundo branco ao receber foco, com contorno de navegação e contraste correto.
- Layouts recentes de Início, Filmes, Séries, TV ao Vivo e player permanecem incluídos nesta versão.

## [2.17.6] — 2026-10-12

### TV premium, player e catálogo

- Guia TV ao vivo redesenhado para navegação D-pad: lista compacta, preview silencioso do canal focado e EPG no painel lateral.
- Enter/OK, DPAD_CENTER e variantes de controles Android TV/Fire TV restauram corretamente o OSD do player.
- Menu lateral da TV retrai fora do foco e expande de forma estável ao recebê-lo.
- Destaques de Início, Filmes e Séries usam imagem real do catálogo com tratamento cinematográfico full-bleed.
- Token TMDB é disponibilizado de forma consistente para a configuração Expo do build de produção.

## [2.17.5] — 2026-10-12

### Correção de regressão de release

- Reconstruído exclusivamente a partir da base funcional 2.17.2 / Checkpoint 90.
- Removida a exclusão nativa indevida de `@expo/ui` introduzida no 2.17.4.
- Mantidas as entregas dos checkpoints 80, 86, 87, 88 e 90.
- Fundo cinematográfico de login aplicado para smartphone e TV; removidos os círculos azuis.
- Versão e build unificados no manifesto Android, configuração Expo, constante interna e tela Sobre.

O histórico público do FlixPlay mantém somente a versão em preparação e a versão estável anterior.

## [2.15.0] — 2026-09-28 (Release Candidate)

### Preparação de release

- Auditoria pré-implementação registrada antes das alterações funcionais.
- Alegações não comprovadas de suporte a M3U e estados estáticos de estabilidade/atualização removidos da tela **Sobre**.
- Histórico interno preparado para mostrar somente a versão instalada e sua antecessora.
- Minutas de termos, privacidade e tratamento de dados adicionadas para revisão jurídica.
- Documentação de homologação, compatibilidade, rollback e problemas conhecidos adicionada ao pacote de release.
- SQLite schema v2 com migration aditiva, índices, paginação, busca e proteção do catálogo válido.
- Credenciais e URLs de reprodução removidas do cache persistente.
- Controle parental nativo protegido pelo Android Keystore e PBKDF2.
- Player modularizado incrementalmente com proteção contra eventos atrasados e progresso em background/PiP.
- Busca global transferida para consultas paginadas no SQLite.
- Menu lateral e foco D-Pad corrigidos para TV.

### Estado

- Esta versão foi gerada como **Release Candidate** para homologação.
- Recursos implementados por outras fases só devem ser incluídos aqui depois de testes objetivos.
- A publicação pública permanece bloqueada até homologação física e validação da atualização assinada.

## [2.14.0] — 2026-09-27

### Player e controle remoto

- Digitação direta do número do canal com troca após 1,5 segundo.
- Mapeamento de CH+/CH- e botões coloridos para ações do player.
- OSD configurável em 3, 5 ou 7 segundos e salto VOD em 10, 30 ou 60 segundos.
- Preferência Auto/HLS/TS e User-Agent aplicados ao player.
- Agrupamento de comandos rápidos de zapping para reduzir condições de corrida.

### Compatibilidade

- Android mínimo API 24 e Target SDK 36.
- APK universal para `armeabi-v7a` e `arm64-v8a`.
- Package `com.fastshot.slitherproduction.flixplay` preservado.
