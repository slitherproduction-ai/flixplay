# Checkpoint 193 — Restauração UTF-8 do Player

Base: `main` no commit `3e7d89639e3081ba4475f1b7a652bb089c8ff3b3` / versão em desenvolvimento 2.17.16.

## Correção

- O blob remoto de `app/player.tsx` estava corrompido: iniciava com bytes não UTF-8, fazendo o Metro falhar em `1:1` com `SyntaxError: Unexpected character`.
- O arquivo foi restaurado a partir da cópia íntegra do checkpoint local confiável, comparada ao último arquivo válido de `9e23a67`.
- Foram preservadas as alterações posteriores aprovadas de proteção parental por categoria para canais, filmes e séries.

## Validações previstas

- Codificação UTF-8 e ausência de bytes de controle no arquivo restaurado.
- Parsing TypeScript/TSX, imports e referências locais.
- Bundle Expo/Metro somente se as dependências estiverem disponíveis no ambiente de desenvolvimento.
