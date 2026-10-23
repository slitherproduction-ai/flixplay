# Checkpoint 202 — Login por Código: HTTP Xtream

Versão: 2.17.16

## Correção

- A autenticação Xtream preserva o protocolo e a porta retornados pelo Portal. Um Host HTTP, como `http://flixplay.sbs`, não é convertido nem repetido como HTTPS.
- A URL de autenticação é formada uma única vez como `{host}/player_api.php?username={usuario}&password={senha}`, removendo barras finais do Host e codificando os parâmetros de consulta.
- A resposta HTTP 404 agora identifica a etapa: resolução de código é tratada pelo Portal; a API Xtream informa autenticação ou catálogo conforme a chamada.
- Logs técnicos registram apenas protocolo, host, porta, caminho e status HTTP. Credenciais não são incluídas.
- Confirmada a permissão HTTP no Android de release: `usesCleartextTraffic=true` e `network_security_config` com cleartext permitido.

## Validação prevista

- Montagem de URL HTTP, HTTPS e com porta explícita.
- Verificação estática de ausência de fallback HTTP → HTTPS.
- Baseline de release sem alteração de versão.
- Teste físico pendente em aparelho com o código `flixplay` e credenciais válidas.
