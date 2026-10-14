# Checkpoint 65 — Últimos canais assistidos

## Entregue

- A reprodução de um canal ao vivo passa a registrar atividade recente, inclusive após zapping/troca de canal no player.
- A seção **Canais ao Vivo** da tela Início prioriza os até cinco canais ao vivo assistidos mais recentemente.
- A grade mantém os dados atuais de EPG, logo e progresso de programação do catálogo sincronizado.
- No primeiro acesso — ou quando não houver histórico de canais válido — a seção mantém a ordem original fornecida pelo servidor.
- O subtítulo da seção informa quando a lista representa os últimos canais assistidos.

## Validação

- `npx tsc --noEmit` concluído.
- `npm run lint` concluído.
- `npm test -- --runInBand` concluído: 26 suítes e 111 testes aprovados.

## Arquivos alterados

- `app/player.tsx`
- `app/(tabs)/index.tsx`
