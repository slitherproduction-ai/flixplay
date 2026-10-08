# Checkpoint 09 — Núcleo XMLTV

Data: 2026-10-05

## Implementado

- Parser XMLTV tolerante para programas por `channel`/`tvg-id`.
- Normalização de data/hora XMLTV com deslocamento de fuso horário.
- Identificação de programa atual, progresso real, horário de início/fim e
  ordenação cronológica.
- Registros incompletos ou inválidos são ignorados sem descartar o guia válido.
- Função de download de XMLTV por URL, com validação de URL e `AbortSignal`.

## Validação

- TypeScript: aprovado.
- Lint direcionado: aprovado.
- Testes XMLTV: 2 aprovados.

## Próximo incremento deste bloco

Integrar a fonte M3U/XMLTV ao cadastro e à sincronização por servidor, para
persistir canais/categorias e preencher o EPG da lista importada.
