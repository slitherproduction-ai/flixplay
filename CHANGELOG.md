# Changelog

Todas as alterações relevantes do FlixPlay são registradas neste arquivo.

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
