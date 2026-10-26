# Checkpoint 214 — Atualizações pelo Portal ELVANOQ Play

- Base: `2.17.16` (`20261031`), branch `main` a partir do checkpoint 213.
- Substitui o cliente de GitHub Releases por `services/portalUpdater.ts`.
- Consulta pública: `https://downloads.elvanoqplay.app/release.json`.
- APK permitido: `https://downloads.elvanoqplay.app/ELVANOQ-Play.apk`.
- A release precisa estar pronta, possuir versão semântica numérica, tamanho positivo, SHA-256 válido e URL oficial. Somente versões superiores à instalada ficam disponíveis para instalação.
- O download mantém progresso e cancelamento; o APK é descartado se tamanho ou SHA-256 divergirem. O hash é calculado nativamente em streaming para não pressionar a memória de TV/Fire TV.
- Nenhuma credencial IPTV, token, MAC ou chave do dispositivo é enviada ao serviço de distribuição.
- Validações estáticas e testes automatizados registrados no commit deste checkpoint; instalação e permissão de fontes desconhecidas exigem validação física em Android/Android TV/Google TV/Fire TV.
