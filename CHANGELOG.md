# Changelog

Todas as alterações relevantes do FlixPlay são registradas neste arquivo.

## [2.12.1] - 2026-09-26

### Correções para Android TV e Fire TV

- Menu lateral totalmente opaco para impedir vazamento visual do conteúdo ao fundo.
- Larguras do menu reduzidas para 68 dp recolhido e 204 dp expandido.
- Ícones e rótulos permanecem montados durante a animação, eliminando opções vazias.
- Navegação vertical do menu encadeada com `nextFocusUp` e `nextFocusDown` nativos.
- Textos comuns deixam de ser selecionáveis no modo TV e não capturam mais o foco do D-Pad.
- Linhas **Abrir último canal** e **Modo Android TV** passam a ser controles inteiros selecionáveis.

### Login

- Campo **Host / URL do servidor** recebe o foco inicial automaticamente ao abrir em uma TV.
- Campo focado recebe borda azul e fundo de alto contraste.
- Botão Conectar não disputa mais o foco inicial com o campo URL.

### Compatibilidade

- Versão Android `2.12.1`, código de versão `20261003`.
- APK universal para `armeabi-v7a` e `arm64-v8a`.
- Android mínimo API 24 e Target SDK 36.
- Assinatura compatível com as versões 2.11.0 e 2.12.0 para atualização direta, preservando os dados locais.

### Segurança

- Conexões Xtream permanecem diretas com o servidor informado pelo usuário, sem encaminhamento de credenciais por proxies CORS públicos.

### Validação

- Verificação TypeScript concluída sem erros.
- Lint concluído sem avisos.
- Quinze testes automatizados aprovados em seis suítes.

## [2.12.0] - 2026-09-26

### Navegação para TV

- Barra inferior substituída no modo TV por menu lateral retrátil, com cinco destinos principais.
- Menu abre ao receber foco, fecha após a navegação e mantém a área de conteúdo visível.
- O estado visual indica simultaneamente a rota selecionada e o item sob foco do D-Pad.
- Último foco de filmes, séries, canais e menu é lembrado durante a sessão e restaurado ao retornar.

### Layout adaptativo

- Celulares continuam usando navegação inferior e gestos touch, sem herdar o shell de TV.
- Grade ao vivo exibe de quatro a seis canais por linha no modo TV e duas ou três colunas no mobile.
- Filmes e séries continuam com cinco a sete cards por linha em TV e três em smartphones.

### Arquitetura e validação

- Rotas de TV e memória de foco isoladas em `core/navigation`.
- Testes unitários adicionados para seleção de rota e restauração de foco.
- Versão Android `2.12.0`, código de versão `20261002`.
- APK universal para `armeabi-v7a` e `arm64-v8a`.
- Android mínimo API 24 e Target SDK 36.

## [2.11.0] - 2026-09-25

### Identidade visual

- Nova logo horizontal substitui o texto FlixPlay no login e na Home.
- Novo ícone aplicado à tela **Sobre**, ao Splash e ao launcher Android.
- Recursos nativos foram gerados para todas as densidades Android e para ícones adaptativos.

### Interface móvel

- Filmes e séries passam a exibir três cards por linha em smartphones.
- Tablets usam quatro ou cinco colunas; Android TV mantém de cinco a sete itens conforme a largura.

### Remoção

- Função Trakt.tv, rota, estado persistido e componentes associados foram removidos.

### Compatibilidade

- Versão Android `2.11.0`, código de versão `20261001`.
- APK universal para `armeabi-v7a` e `arm64-v8a`.
- Android mínimo API 24 e Target SDK 36.
- Assinatura compatível com a versão 2.10.1 para atualização direta, preservando os dados locais.

### Segurança

- Conexões Xtream permanecem diretas com o servidor informado pelo usuário, sem encaminhamento de credenciais por proxies CORS públicos.

### Validação

- Verificação TypeScript concluída sem erros.
- Lint concluído sem avisos.
- Onze testes automatizados aprovados em cinco suítes.

## [2.10.1] - 2026-09-24

### Correções

- Aviso de saída do player reconstruído com painel responsivo, sem colapso de conteúdo no Android em modo paisagem.
- Botões **Continuar assistindo** e **Sair** passam a ocupar corretamente a largura disponível em smartphones.

### Melhorias

- EPG dos canais em destaque é pré-carregado na Home sem iniciar a reprodução.
- A tela **TV ao Vivo** pré-carrega os primeiros canais e atualiza o EPG dos cards visíveis durante a rolagem.
- Requisições EPG simultâneas são deduplicadas, limitadas a quatro conexões e mantidas em cache por cinco minutos.
- Cartão **Servidor ativo / Validade** removido da tela inicial, incluindo estados, estilos e código sem uso.
- Imagens do template, mockups e anexos de desenvolvimento não utilizados foram removidos do projeto distribuído.

### Compatibilidade

- Versão Android `2.10.1`, código de versão `20260930`.
- APK universal para `armeabi-v7a` e `arm64-v8a`.
- Android mínimo API 24 e Target SDK 36.

### Segurança

- Conexões Xtream permanecem diretas com o servidor informado pelo usuário, sem encaminhamento de credenciais por proxies CORS públicos.

### Validação

- Verificação TypeScript concluída sem erros.
- Lint concluído sem erros.
- Onze testes automatizados aprovados em cinco suítes.

### Instalação

- O APK 2.10.1 usa uma nova chave de desenvolvimento porque a chave privada da 2.10.0 não estava disponível no projeto recuperado.
- Pode ser necessário desinstalar a versão anterior antes da instalação, o que remove os dados locais do aplicativo.
- Para publicação contínua ou em loja, deve ser adotada e preservada uma chave definitiva de produção.

## [2.10.0] - 2026-09-24

### Interface para TV

- Grade adaptativa com 5, 6 ou 7 pôsteres visíveis por linha, conforme a largura da tela.
- Banner principal limitado a 40% da altura útil, entre 250 e 350 dp no modo TV.
- Foco D-Pad com escala de 1,05x, borda azul e sombra.
- Carrosséis horizontais virtualizados para reduzir renderização e melhorar a rolagem.

### Player

- OSD com ocultação automática após 4 segundos e animação de saída em 260 ms.
- Interações pelo controle remoto reabrem o OSD e reiniciam seu temporizador.
- Máquina de estados única para `hidden`, `osd`, `quick-zapping`, `epg`, `cast` e confirmação de saída.
- OSD, EPG, Zapping Rápido e Cast passam a ser mutuamente exclusivos.
- A tecla Voltar fecha primeiro o painel ou overlay ativo; sem overlay aberto, exibe a confirmação de saída.
- PiP nativo, EPG real e progresso real de filmes e episódios foram preservados.

### Segurança

- Conexões Xtream continuam usando somente o servidor informado pelo usuário.
- Credenciais não são encaminhadas por proxies CORS públicos; no navegador, conexões bloqueadas devem usar HTTPS ou o aplicativo nativo.

### Compatibilidade

- Versão Android `2.10.0`, código de versão `20260929`.
- APK universal para `armeabi-v7a` e `arm64-v8a`.
- Android mínimo API 24 e Target SDK 36.
- Assinatura APK Signature Scheme v2.

### Validação

- Verificação TypeScript concluída sem erros.
- Lint concluído sem erros.
- Onze testes automatizados aprovados.

## [2.9.0] - 2026-09-23

### Novidades

- Zapping rápido com seleção da grade de canais ao vivo, categorias e favoritos.
- EPG real do provedor Xtream com programa atual e próximo exibidos no player.
- Picture-in-Picture nativo do Android para smartphones e dispositivos compatíveis.

### Melhorias

- Barra de progresso baseada na duração e na posição real de reprodução de filmes e episódios.
- Retomada automática no ponto salvo ao abrir novamente um conteúdo.
- Histórico **Continuar Assistindo** atualizado durante a reprodução e organizado pelo acesso mais recente.
- Indicadores de progresso exibidos nos cards da página inicial e da tela **Continuar Assistindo**.
- Informações da tela **Sobre** atualizadas para `v2.9.0 • Build 20260928`.
- Conexões Xtream passam a usar somente o servidor informado pelo usuário, sem encaminhar credenciais por proxies públicos.

### Compatibilidade

- APK universal para `armeabi-v7a` e `arm64-v8a`.
- Android mínimo API 24 e Target SDK 36.
- Compatibilidade mantida com Fire TV, FireStick e smartphones Android.
- Assinatura compatível com a versão 2.8.4 para atualização direta, preservando os dados do aplicativo.

### Validação

- Verificação TypeScript concluída sem erros.
- Lint concluído sem erros.
- Cinco testes automatizados aprovados, incluindo os testes de EPG.

## [2.8.4] - 2026-09-23

### Correções e melhorias

- Compatibilidade universal com Fire TV em dispositivos ARM de 32 e 64 bits.
- Informações de versão e build sincronizadas na tela **Sobre** e em **Ajustes**.
- Histórico interno limitado às duas versões mais recentes.
- Nova tela **Continuar Assistindo** para filmes e séries.
- Melhorias no miniplayer, Picture-in-Picture, busca e atualização via GitHub Releases.
