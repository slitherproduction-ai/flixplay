# Checkpoint 208 — Domínio oficial do Portal

## Base

- Versão: 2.17.16
- Branch: `main`
- Checkpoint anterior: 207

## Implementação

- Centralizada a origem pública do Portal em `constants/portal.ts`: `https://elvanoqplay.app`.
- `buildPortalUrl` preserva caminhos relativos e codifica os parâmetros recebidos; a origem do site não é reutilizada para APIs, pagamentos ou listas IPTV.
- Em **Listas Salvas**, o botão **Gerenciar no Portal** abre o endereço oficial no navegador externo. O vínculo de chave, a sincronização e a seleção de listas continuam no aplicativo.
- Não havia referência cliente ao domínio legado `elvanoq-play-portal.slitherproduction.chatgpt.site`, a `elvanoplay.app`, nem QR Code próprio apontando ao Portal. O QR Code existente continua sendo exclusivamente o Pix retornado pela PagHiper.

## Preservações

- URLs Supabase (`portal-control` e `paghiper-payments`) permanecem inalteradas.
- Hosts, protocolos e portas das listas IPTV, inclusive HTTP, não foram modificados.
- Nenhum dado local, sessão, credencial, identidade MAC/chave, favorito, histórico ou licença foi removido ou convertido.
- Licenciamento por código e por Host/DNS de listas sincronizadas permanece inalterado.

## Limitação de validação externa

O Portal está privado no Sites. O destino é verificado por composição estática e pelo uso de `Linking.openURL`; não foi feita autenticação do ChatGPT, nem tentativa de contornar a proteção para validar páginas privadas.
