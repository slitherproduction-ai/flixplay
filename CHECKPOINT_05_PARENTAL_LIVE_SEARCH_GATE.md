# Checkpoint 05 — Bloqueio parental em TV ao vivo e busca

Data: 2026-10-04

## Implementado nesta etapa

- Criado `components/parental-gate.tsx`, diálogo reutilizável que valida o PIN
  exclusivamente pelo cofre seguro nativo e apresenta o bloqueio temporário
  retornado pelo módulo Android.
- A abertura de canais em **TV ao Vivo** agora verifica o bloqueio por ID antes
  de navegar ao player. Após um PIN válido, somente o canal solicitado é aberto.
- A **Busca global** também verifica o bloqueio antes de abrir canais, filmes ou
  séries, impedindo que essa rota contorne a proteção já aplicada nos detalhes.
- Os bloqueios continuam vindo de `userDataByServer`; portanto, o estado segue
  isolado por servidor ativo.

## Validação

- Dependências do projeto foram restauradas com `npm ci --ignore-scripts`.
- TypeScript, lint e Jest foram iniciados, mas não concluíram dentro do limite
  de execução disponível desta sessão. Não há resultado de aprovação registrado
  para esta etapa até que sejam executados integralmente.

## Próxima sequência

1. Executar TypeScript, lint e Jest integralmente.
2. Aplicar o mesmo gate a Favoritos, Histórico/Continuar assistindo, player,
   zapping, PiP e restauração do último canal.
3. Criar testes de regressão para confirmar que nenhuma rota abre conteúdo
   bloqueado sem PIN e que cancelamento não inicia reprodução.
