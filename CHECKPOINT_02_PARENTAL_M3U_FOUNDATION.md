# Checkpoint 02 — Fundação parental e M3U

Este checkpoint preserva o estado de desenvolvimento após as seguintes alterações:

- Tela de Controle parental em `app/settings/parental.tsx` para criar, alterar e remover o PIN usando somente o cofre Android.
- Entrada de Ajustes para o Controle parental.
- Parser M3U Plus com `tvg-id`, logo, grupo, número de canal e deduplicação por stream.
- Serviço de abertura em player externo Android preparado e mantido oculto enquanto a interface do player não o integrar.
- Isolamento de favoritos e histórico por servidor, ordenação por data Xtream e sincronização parcial independente preservados do checkpoint anterior.

Validação deste checkpoint:

- TypeScript aprovado.
- ESLint aprovado.
- Jest: 21 suítes e 96 testes aprovados.

Próximo checkpoint:

- Bloqueio parental central em detalhes e player; depois importação persistida M3U/XMLTV por servidor.
