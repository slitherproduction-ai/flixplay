# Checkpoint 183 — foco claro e estabilidade de detalhes

Base: versão 2.17.15, build 20261030.

## Alterações

- Corrigida a camada comum `TVFocusable`: foco não substitui mais o fundo do controle por transparência e não aplica elevação que escurece ações claras no Android TV/Fire TV.
- `getSeriesInfo` aceita cancelamento por `AbortSignal`; a tela de detalhes interrompe a consulta de episódios quando o usuário troca de conteúdo ou sai da tela.
- A lista de conteúdos similares é limitada durante a iteração, sem criar uma cópia completa de catálogos grandes.
- Sinopse e TMDB são enriquecimentos opcionais executados após a transição de navegação e em sequência, sem competir com a carga de episódios.

## Arquivos

- `components/tv-focusable.tsx`
- `services/xtream.ts`
- `app/details/[id].tsx`
- `CHANGELOG.md`

## Validação prevista

- Verificação de diff, sintaxe/TypeScript disponível no ambiente e baseline de release.
- Sem build Android ou APK neste checkpoint.
