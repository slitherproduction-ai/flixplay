# FlixPlay 2.10.0

Build Android: `20260929`

## Interface para TV

- Grade adaptativa com 5, 6 ou 7 posters visíveis por linha, conforme a largura da tela.
- Banner principal limitado a 40% da altura útil, entre 250 e 350 dp no modo TV.
- Foco D-Pad com escala de 1,05x, borda azul e sombra.
- Carrosséis horizontais virtualizados para reduzir renderização e melhorar a rolagem.

## Player

- OSD com auto-hide de 4 segundos e fade-out de 260 ms.
- Toda interação remota reabre o OSD e reinicia o temporizador.
- Máquina de estados única para `hidden`, `osd`, `quick-zapping`, `epg`, `cast` e confirmação de saída.
- EPG, Zapping Rápido, Cast e controles são mutuamente exclusivos.
- A tecla Voltar fecha primeiro painel/opção ou overlay; sem overlay, abre confirmação de saída.
- Mantidos PiP nativo, EPG real e progresso real de filmes e episódios.

## Compatibilidade validada

- Android SDK mínimo 24; alvo 36.
- APK universal com `armeabi-v7a` e `arm64-v8a`.
- Assinatura APK Signature Scheme v2.
- TypeScript, lint e 11 testes automatizados aprovados.

## Segurança

- Conexões Xtream continuam usando somente o servidor informado pelo usuário.
- Credenciais não são encaminhadas por proxies CORS públicos; no navegador, use HTTPS ou o aplicativo nativo quando houver bloqueio de CORS/Mixed Content.

## Observação de distribuição

O APK local está assinado com o certificado de desenvolvimento já usado pelo projeto. Para publicação em loja, utilize a chave de produção definitiva e preserve-a em todas as atualizações futuras.
