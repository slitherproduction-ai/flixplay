# Checklist de homologação — FlixPlay 2.13.0

Registre dispositivo, versão do sistema, resultado e evidência para cada execução.

## Dispositivos

- [ ] Fire TV Stick de entrada
- [ ] Fire TV Stick 4K
- [ ] Android TV com pouca memória
- [ ] Google TV
- [ ] Smartphone Android antigo (API 24+)
- [ ] Smartphone Android intermediário
- [ ] Smartphone Android atual
- [ ] Tablet Android

## Instalação e atualização

- [ ] Instalação limpa
- [ ] Atualização sobre 2.11.0
- [ ] Atualização sobre 2.12.0
- [ ] Atualização sobre 2.12.1
- [ ] Package name preservado
- [ ] Certificado igual ao das versões anteriores
- [ ] Migração mantém todas as listas salvas
- [ ] AsyncStorage legado deixa de conter o snapshot após migração

## Login e segurança

- [ ] Host sem protocolo
- [ ] HTTP, HTTPS e porta personalizada
- [ ] Credenciais inválidas, timeout, resposta malformada e servidor offline
- [ ] Aviso discreto em HTTP
- [ ] URL, usuário e senha ausentes dos logs e relatório
- [ ] Exclusão de uma lista remove cofre e cache correspondente
- [ ] Excluir todas remove todas as credenciais e catálogos

## TV e D-Pad

- [ ] Foco inicial no Host
- [ ] Ordem Host → Usuário → Senha → Nome → Conectar
- [ ] Menu abre pela esquerda e retorna ao conteúdo pela direita
- [ ] Foco não some nem entra em textos decorativos
- [ ] Cards restauram foco após detalhes/player
- [ ] Modal aprisiona foco e Voltar fecha a camada superior
- [ ] Switches selecionáveis pela linha inteira

## Dados e desempenho

- [ ] Listas de 5.000, 15.000 e 30.000 itens
- [ ] Canais disponíveis antes de filmes e séries
- [ ] Falha isolada de filmes e de séries
- [ ] Troca de servidor cancela sincronização anterior
- [ ] Cache offline após reiniciar o aplicativo
- [ ] Favoritos e histórico preservados após atualização incremental
- [ ] Uso de memória aceitável após 30 minutos de navegação

## Player

- [ ] HLS e TS ao vivo
- [ ] Filme e episódio com retomada
- [ ] Conclusão em 95% remove de Continuar assistindo
- [ ] Áudio real troca efetivamente
- [ ] Legenda real ativa/desativa
- [ ] Controles ausentes quando não há faixas
- [ ] Zapping rápido e canal anterior
- [ ] EPG atual/próximo e grade
- [ ] PiP entra, sai e preserva reprodução/progresso
- [ ] Wi-Fi lento e perda de conexão

## Atualização e diagnóstico

- [ ] Versão superior, igual, inferior e tag inválida
- [ ] Release draft/prerelease ignorada
- [ ] Release sem APK não oferece download
- [ ] Asset HTTP ou vazio recusado
- [ ] Diagnóstico mostra contagens e cache reais
- [ ] Relatório compartilhado não contém segredos
