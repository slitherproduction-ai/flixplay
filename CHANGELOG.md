# Changelog

## [2.17.16] — Em desenvolvimento

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
