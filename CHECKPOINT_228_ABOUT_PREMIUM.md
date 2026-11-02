# Checkpoint 228 — Sobre premium

## Versão

- **2.17.19**, build **20261037** (anterior: 2.17.18, build 20261036).

## Alteração

- `app/settings/about.tsx`: tela principal reconstruída (destaque, cartão de Atualizações com estado inline, novidades, recursos em grade, informações agrupadas, link do Portal). `UpdateModal`, `runInstallUpdate` e a preferência `autoUpdate` preservados. Hook de toast removido.
- `app/login.tsx`: fundo do login trocado pela arte do Roku 1.0.1 (`ELVANOQ_login_tv_backdrop_v5.jpg` 1920×1080 e `ELVANOQ_login_mobile_backdrop_v5.jpg` 1080×1920, composição vertical própria). Arquivos v4 removidos.
- `components/update-available-notice.tsx`: foco visível por D-Pad nos botões; Voltar ignorado durante o download.

## Validação

- Verificação de sintaxe (transpile) dos arquivos alterados e `tools/verify-release-baseline.sh`.
- Teste físico e APK pendentes da compilação pelo GitHub Actions.
