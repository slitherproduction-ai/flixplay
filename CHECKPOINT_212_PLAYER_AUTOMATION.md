# Checkpoint 212 — Automação segura de episódios

Base: versão 2.17.16, build Android 20261031, branch `main`, após CP211.

## Entrega

- Próximo episódio: contagem de seis segundos no fim de um episódio, avanço automático apenas ao terminar e opção de cancelamento. O botão manual continua disponível.
- Abertura: suporte a `intro_end_seconds` e `introEndSeconds` retornados explicitamente pelo provedor Xtream. Sem marcador, o aplicativo não supõe uma duração de abertura.
- Interface: ações claras, brancas e com foco compatível com TV; a contagem torna o OSD visível uma vez para que o usuário possa cancelar.

## Arquivos

- `features/player/EpisodeAutomation.ts`
- `__tests__/features/player/EpisodeAutomation.test.ts`
- `app/player.tsx`
- `app/details/[id].tsx`
- `store/types.ts`
- `README.md`
- `CHANGELOG.md`

## Preservação

Não altera hosts, listas, Portal, licença, controle parental, favoritos, progresso, PiP ou reprodução de TV ao vivo. O marcador depende do servidor IPTV; teste físico é necessário para validar o evento nativo de término em cada aparelho.
