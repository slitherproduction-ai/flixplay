# Checkpoint 32 — ícones e splash sem sobreposição

## Alterações concluídas

- Corrigida a composição do ícone adaptativo Android: o fundo agora é somente
  o degradê escuro e o símbolo branco está exclusivamente no primeiro plano.
- Criado ícone clássico independente para launchers que não usam ícones
  adaptativos.
- Atualizados os splashes de celular e TV para uma única marca branca sobre
  fundo escuro, sem camadas concorrentes.
- Atualizados os ativos de marca usados pela navegação e pelas telas internas,
  para que o símbolo visível no aplicativo seja o mesmo do launcher.
- Reaplicado o fallback do catálogo: a ausência do módulo de cache nativo não
  pode interromper a listagem recebida do servidor IPTV.

## Arquivos de marca

- `assets/images/brand/ELVANOQ_app_icon_v2.png`
- `assets/images/brand/ELVANOQ_adaptive_foreground_v2.png`
- `assets/images/brand/ELVANOQ_adaptive_background_v2.png`
- `assets/images/brand/ELVANOQ_splash_mobile_v2.png`
- `assets/images/brand/ELVANOQ_splash_tv_v2.png`

## Verificações pendentes deste checkpoint

- Validar configuração Expo, tipos e lint antes de solicitar geração do APK.
