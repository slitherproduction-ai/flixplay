# Homologação física — ELVANOQ 2.17.0

> Classificação atual: **Release Candidate — não autorizada para lançamento público**.
> Marque um item como aprovado somente após executá-lo em aparelho real e anexar a evidência. Não registre URL, usuário, senha ou stream nas evidências.

## Pré-requisitos da execução

- APK/AAB final assinado com a mesma chave da versão instalada, hash SHA-256 e versão/build anotados abaixo.
- Rede Wi-Fi estável e uma segunda rede com limitação ou interrupção controlada.
- Uma lista de homologação autorizada, sem credenciais incluídas neste documento.
- Captura de tela/vídeo, `adb logcat` sanitizado quando disponível e resultado do diagnóstico do aplicativo.

| Campo | Registro |
|---|---|
| Artefato / SHA-256 | Pendente de build final |
| Certificado | Pendente de conferência |
| Executor / data | Pendente |
| Lista de homologação | Configurada no aparelho — não registrar segredos |

## Dispositivos obrigatórios

| Dispositivo | Sistema | Build | Resultado | Evidência | Status |
|---|---|---|---|---|---|
| Smartphone Android API 24+ | Pendente | Pendente | Não executado | — | Pendente |
| Smartphone Android atual | Pendente | Pendente | Não executado | — | Pendente |
| Android TV / Google TV | Pendente | Pendente | Não executado | — | Pendente |
| Fire TV / Fire Stick | Pendente | Pendente | Não executado | — | Pendente |

## Cenários críticos

| Fluxo | Critério de aprovação | Status |
|---|---|---|
| Instalação e atualização | Instalação limpa e atualização sobre a versão anterior preservam preferências, favoritos e progresso; assinatura compatível. | Pendente |
| Login Xtream | Host com porta válida conecta; erro TLS do provedor informa a causa sem tentar atribuí-la à senha; segredos não aparecem em logs. | Pendente |
| M3U + XMLTV | Importação completa, contagem coerente e EPG atual/próximo exibidos. | Pendente |
| Catálogo grande | 30 mil itens navegam sem fechamento; busca, categorias e retorno preservam posição. | Pendente |
| Cache e troca de servidor | Reinício offline usa cache válido; troca cancela sincronização anterior sem misturar catálogos. | Pendente |
| Player | Live HLS/TS, filme e episódio reproduzem; retomada, áudio, legenda, PiP e erro de rede têm comportamento real. | Pendente |
| Catch-up | Ação aparece apenas quando declarada pelo provedor e abre conteúdo válido. | Pendente |
| Touch e TV | Touch, D-Pad, Voltar, foco inicial e retorno ao card funcionam sem foco perdido. | Pendente |
| Controle parental | PIN bloqueia e libera detalhes/reprodução conforme política. | Pendente |
| Diagnóstico | Versão, build, cache e contagens reais; relatório sanitizado. | Pendente |

## Registro de ocorrências e retestes

| ID | Dispositivo | Cenário | Resultado | Erro / correção | Evidência | Reteste |
|---|---|---|---|---|---|---|
| — | — | — | Não executado | — | — | — |

## Decisão de liberação

Liberar somente quando todos os cenários críticos forem aprovados nos aparelhos obrigatórios, com APK/AAB assinado e assinatura compatível verificada. Qualquer falha de TLS do servidor de conteúdo é bloqueador externo: deve ser resolvida pelo provedor ou substituída por endpoint Xtream válido antes da aprovação do fluxo de login.
