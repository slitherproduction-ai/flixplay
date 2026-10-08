# Checkpoint 18 — Pré-carregamento de EPG

## Correção aplicada

- A Home passou a iniciar a fila de EPG para os primeiros 60 canais logo após o catálogo estar disponível.
- A tela TV ao Vivo passou a pré-carregar os primeiros 80 canais da consulta atual, além dos itens que entram na área visível.
- A concorrência continua limitada a quatro consultas para evitar travamento em Fire TV/Android TV e sobrecarga no provedor.

## Validação

- ESLint direcionado: aprovado.
- TypeScript: aprovado.
- Testes EPG e catálogo grande: 2 suítes / 5 testes aprovados.

O Histórico de Versões não foi modificado.
