# Checkpoint 151 — Área segura do ícone Android

**Data:** 18/10/2026  
**Versão de referência:** 2.17.14  
**Checkpoint anterior:** 150  
**Base sincronizada:** `90c51e515abccc351a23167d5698f6550beacab6`

## Correção

O símbolo do ELVANOQ ocupava uma área visual maior que a recomendada em ícones e na marca nativa de abertura. Foram criados novos assets centralizados, com o símbolo em 78% da escala anterior, preservando o fundo escuro e a identidade da marca.

O splash nativo também passou a usar `contain`, evitando ampliação/corte do asset em formatos de tela diferentes.

## Arquivos alterados

- `app.json`
- `assets/images/brand/ELVANOQ_adaptive_foreground_v3.png`
- `assets/images/brand/ELVANOQ_app_icon_v3.png`
- `assets/images/brand/ELVANOQ_splash_native_mark_v4.png`
- Recursos `ic_launcher`, `ic_launcher_round`, `ic_launcher_foreground` e `splashscreen_logo` em todas as densidades Android
- `CHANGELOG.md`
- `CHECKPOINT_151_ANDROID_ICON_SAFE_AREA.md`

## Validação executada

- Conferência de dimensões dos assets: 1024 × 1024.
- Inspeção visual do ícone composto e dos recursos nativos gerados.
- Verificação estática da configuração Expo e das referências Android.

## Pendente

- Compilar pelo GitHub Actions e validar no launcher e abertura de um Android/Fire TV físico.
