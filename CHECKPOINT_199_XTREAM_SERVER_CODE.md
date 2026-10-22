# Checkpoint 199 — Login Xtream por código do Portal

- Versão: 2.17.16
- Base: checkpoint 198 / commit `48f121a54670c9ab1c9a5d93ed1093bc706c52b3`

## Escopo

- Incluída modalidade adicional **Código do servidor** com os campos Código, Usuário e Senha.
- O código é normalizado para minúsculas após remover espaços externos e validado antes da rede.
- A resolução usa `portal-control/server-code-resolve` com a chave publicável já utilizada pelo aplicativo. Credenciais IPTV não são enviadas nessa consulta.
- A resposta aceita somente uma origem HTTP(S) sem usuário, senha, caminho ou consulta.
- Após autenticação Xtream, a lista é salva com a identidade estável do código. Uma reconexão resolve novamente o código, atualiza Host/DNS quando necessário e reaproveita a mesma lista, dados locais e favoritos.
- Falhas de rede, timeout, código inválido, inexistente/desativado, resposta inválida e credenciais Xtream incorretas mantêm a lista ativa anterior intacta.
- Xtream por Host, M3U, player, favoritos, controle parental e listas do Portal foram preservados.

## Servidor

A Edge Function `portal-control` já continha e mantém o endpoint `server-code-resolve`; nenhuma credencial administrativa ou `service_role` foi adicionada ao aplicativo e nenhuma mudança de servidor foi necessária neste checkpoint.

## Validação

- Inspeção do contrato da Edge Function implantada e teste HTTP real de código sintaticamente válido inexistente: retorno 404 esperado.
- Casos de sucesso, mudança de DNS, timeout e resposta inválida foram cobertos pela estrutura de validação e precisam de confirmação com um código ativo de homologação e em aparelho físico.
- `git diff --check` e `tools/verify-release-baseline.sh` executados no checkout disponível.
- TypeScript e bundle dependem de `node_modules`, indisponíveis no ambiente; nenhuma compilação/APK foi gerada.
