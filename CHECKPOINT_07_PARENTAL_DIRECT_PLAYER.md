# Checkpoint 07 — Proteção do player direto e PiP

Data: 2026-10-04

## Implementado nesta etapa

- A rota do player passou a avaliar o conteúdo antes do autoplay. Isso protege
  aberturas diretas por rota interna, expansão do PiP e demais fluxos que
  chegam ao player sem passar pelas telas de catálogo.
- Conteúdo protegido inicia pausado e exibe o gate de PIN; cancelar retorna à
  tela anterior sem iniciar a reprodução.
- A expansão do PiP pausa o miniplayer e abre o player, que executa a mesma
  validação central. Assim há apenas uma confirmação de PIN.
- Criada a função `isPlaybackBlocked`, que também reconhece episódios quando
  o bloqueio foi configurado na série-pai.
- Adicionados quatro testes unitários para item comum, item bloqueado, herança
  de bloqueio da série e identificador-pai vazio.

## Cobertura atual

As entradas de detalhes, TV ao vivo, busca, histórico, Home, zapping, grade
rápida, canal anterior, dígitos, PiP e rota direta do player convergem para a
mesma verificação de bloqueio.

## Próxima sequência

1. Restaurar dependências e concluir TypeScript, lint e Jest integralmente.
2. Corrigir eventuais falhas de validação e adicionar testes de interface do
   diálogo de PIN.
3. Executar build Android e homologação física antes de gerar APK público.
