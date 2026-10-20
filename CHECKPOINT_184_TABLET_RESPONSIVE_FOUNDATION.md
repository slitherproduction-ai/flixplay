# Checkpoint 184 — fundação responsiva para tablet

Base: versão 2.17.15, build 20261030. Checkpoint anterior: 183.

## Escopos cobertos

- Classificação central por dimensões: smartphone, tablet retrato, tablet paisagem e TV.
- Home com hero e fileiras proporcionais ao tablet.
- Filmes, Séries e Assistir Mais Tarde com grades próprias para tablet.
- TV ao Vivo com gutters e quantidade de cards ajustados para tablet.
- Login centralizado, com largura máxima e composição específica para tablet em paisagem.
- Detalhes com hero, metadados, ações, episódios e recomendações dimensionados para tablet.

## Preservação

- Smartphone continua usando sua composição compacta.
- Android TV, Google TV e Fire TV continuam usando somente o modo TV e suas regras de D-Pad.
- Nenhum APK ou build Android foi gerado.

## Arquivos

- `hooks/use-responsive-layout.ts`
- `app/(tabs)/index.tsx`
- `app/(tabs)/movies.tsx`
- `app/(tabs)/series.tsx`
- `app/(tabs)/live.tsx`
- `app/details/[id].tsx`
- `app/login.tsx`
- `app/watch-later.tsx`
- `CHANGELOG.md`
