# Checkpoint 39 — Player: tipografia de referência

## Ajustes concluídos

- Título do canal/conteúdo: 32 px, linha de 37 px.
- Grupo/tipo do conteúdo: 15 px.
- Programa atual/estado de reprodução: 16 px.
- Tag LIVE: 14 px.
- EPG: rótulos 11 px, títulos 13–14 px e horários 12 px.
- Timeline: horários 12 px para manter leitura à distância.

## Proteções de interface

- Títulos e programas permanecem limitados a uma linha.
- O bloco textual usa espaço flexível para não sobrepor a tag LIVE.
- As barras laterais, botões centrais e painéis de opções não tiveram suas
  dimensões aumentadas.

## Validação

- `npx tsc --noEmit`: aprovado.
- `EXPO_NO_TELEMETRY=1 npm run lint`: aprovado.
- 4 suítes e 15 testes de player/EPG aprovados.
- Nenhum APK foi gerado nesta etapa.
