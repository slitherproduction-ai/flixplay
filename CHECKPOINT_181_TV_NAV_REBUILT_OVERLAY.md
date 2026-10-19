# Checkpoint 181 — Menu lateral TV reconstruído

Base: checkpoint 180 (`40c2ca9c02416ad4fa326b9cf1fa6661247ec8b6`)

## Reconstrução

- Substituído integralmente o componente `tv-side-navigation.tsx`.
- Rail estrutural fixado em 64 px: é a única largura reservada pela tela de conteúdo.
- Ao receber foco, um drawer opaco de 232 px é aberto como sobreposição; ele não redimensiona nem força nova montagem das telas TV.
- Todos os destinos permanecem montados durante a navegação vertical. A seta direita fecha somente o drawer e transfere o foco para o conteúdo.
- Rótulos não usam `opacity`; no rail recolhido eles são apenas recortados pelo limite físico do drawer.
- Ícones reduzidos para 12 px, com foco sólido e sem sombra/elevation extra no item.

## Referência de comportamento

Implementação segue o padrão demonstrado no vídeo: coluna estreita de ícones fora de foco e painel lateral maior, sobreposto, quando o menu recebe foco.

## Impacto de layout

- Filmes, Séries e TV ao Vivo passam a calcular sua largura considerando somente os 64 px permanentes do rail.
- O drawer expandido não ocupa espaço adicional no layout de conteúdo.
