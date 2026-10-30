# Checkpoint 221 — Início no formato hub do Roku

## Base

- Versão de desenvolvimento: **2.17.16**.
- Checkpoint anterior: **220**.
- Referência: ELVANOQ Play Roku **0.1.88** (`HomeView.xml` / `HomeView.brs`).

## Paridade com o Roku

| Roku 0.1.88 | Android |
| --- | --- |
| Destaque largo (640/1080) com sombras topo/esquerda/base | Destaque de ponta a ponta (≈60% da altura em TV) com gradientes equivalentes |
| Ordem: Destaque da semana → Recém-adicionado → Mais bem avaliado → retornos | Mesma ordem e retornos, filmes e séries |
| `heroTimer` 8 s, pausa nos botões | 8 s, pausa com foco nos botões e fora da Início |
| Assistir agora / Ver episódios + Minha Lista | Idem + Detalhes (ícone) |
| Blocos: TV ao Vivo, Filmes, Séries, Busca, Minha Lista, Ajustes | Idem, com contagem do catálogo; sem menu lateral na Início em TV |
| Fileira: Continuar → Seus favoritos → Novidades para você | Idem, seguida de fileiras complementares |

## Arquivos

- `app/(tabs)/index.tsx`
- `app/(tabs)/_layout.tsx`
- `CHANGELOG.md`

## Validação

- Verificação de sintaxe TypeScript dos arquivos alterados.
- Pendente: `npx tsc --noEmit`, `npm test -- --runInBand` e `npm run lint` com as dependências instaladas.
- Pendente teste físico: foco D-pad destaque → blocos → fileiras; retorno à Início com foco no bloco de origem; rotação pausada nos botões; desempenho da luz ambiente em Fire TV Stick.
