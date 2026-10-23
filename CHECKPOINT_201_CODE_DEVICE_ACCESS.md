# Checkpoint 201 — Controle de acesso por código e dispositivo

- Versão: 2.17.16
- Base: checkpoint 200 / commit `934726ba3bb462eb66e4884f6490c42d5f56fe92`

## Implementação

- O acesso por código passou a validar MAC e chave persistente da instalação depois de uma autenticação Xtream válida.
- A autorização exige simultaneamente `license.can_play` e `code_access.can_connect`. HTTP 403 é interpretado pelo conteúdo validado de `code_access`, nunca como pagamento automaticamente.
- O app revalida no retorno ao primeiro plano e, somente em primeiro plano, a cada cinco minutos. Chamadas simultâneas são evitadas.
- Negativas explícitas bloqueiam globalmente a interface e encerram a rota do player para liberar o decoder.
- Instabilidade de rede não é apresentada como expiração. Após uma autorização confirmada, existe tolerância documentada de até 15 minutos; fora dela o app informa indisponibilidade.
- O bloqueio apresenta motivo, MAC, validade, consulta manual e retorno ao login. Dispositivo suspenso/removido não recebe atalho de pagamento.
- Pix usa `paghiper-payments` com dados do pagador somente após consentimento explícito. `payment_access` tem 32 bytes criptograficamente seguros, é separado da chave do dispositivo e fica no SecureStore.
- QR Code, Pix Copia e Cola, valor, MAC, vencimento e status vêm do servidor. Polling é limitado a 15 segundos, cobranças pendentes são reutilizadas e o app não confirma pagamentos.

## Segurança

- Nenhuma credencial IPTV, segredo PagHiper ou `service_role` foi adicionada ao aplicativo.
- Não há logs de senha, CPF/CNPJ ou token de pagamento.

## Validação

- Contratos reais de `portal-control` e `paghiper-payments` foram inspecionados antes da integração.
- Baseline de release e `git diff --check` aprovados no checkout disponível.
- TypeScript, bundle, cenários PagHiper reais e teste físico dependem das dependências, ambiente de compilação e dados de homologação; nenhum APK foi gerado.
