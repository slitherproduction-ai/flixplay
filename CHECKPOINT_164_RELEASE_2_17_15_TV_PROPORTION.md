# Checkpoint 164 — Release 2.17.15: proporção TV

Data: 2026-10-18  
Versão: `2.17.15`  
Build Android / versionCode: `20261030`

## Entrega

- Hero da Tela Inicial e do catálogo TV compactados para preservar a hierarquia de conteúdo.
- Grades de Filmes e Séries TV densificadas para reduzir os pôsteres.
- Tipografia de hero e detalhes TV alinhada à escala compacta do aplicativo.
- TV ao Vivo com preview reequilibrado e coluna de canais no mesmo padrão visual de categorias.
- Inclui as correções persistidas de foco do menu lateral do checkpoint 162.

## Versão sincronizada

- `app.json`
- `package.json`
- `android/app/build.gradle`
- `constants/app.ts` (tela de login, Ajustes e menu lateral)
- histórico interno de versões, README e changelog

## Validações pendentes de compilação

- TypeScript e bundle exigem dependências do projeto no ambiente de compilação.
- Teste físico em Fire TV / Fire Stick deve confirmar escala, foco e reprodução do preview.
