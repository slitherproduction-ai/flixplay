# Checkpoint 197 — Sincronização de listas do Portal

- Versão: 2.17.16
- Base: checkpoint 196 / commit 2ab2023154ce486af304445c05b5901b31d4bcb3
- Branch: main

## Entrega

- A Edge Function `portal-control` passou a expor `playlist-sync`, que devolve somente a lista vinculada ao dispositivo após validar MAC e chave. O aplicativo não recebe nem contém `service_role`.
- A lista retornada (M3U ou Xtream) é persistida como lista gerenciada pelo Portal, com identificador estável por dispositivo. Atualizações substituem apenas essa lista; listas locais e a lista ativa não são alteradas.
- O login tenta sincronização sem bloquear a entrada; a ação também ocorre ao retornar à tela e ao abrir `Listas Salvas`. A tela oferece atualização manual e vínculo explícito da chave gerada no Portal.
- Se o Portal estiver indisponível, o aplicativo mantém listas locais/offline. Credenciais não são apresentadas na interface.

## Contrato do servidor implantado

- Projeto Supabase: `xrrgjssvdqvtrqhxpask`.
- Função: `portal-control`, versão 11.
- Ação: `playlist-sync`.
- Acesso: `POST { action, mac, device_key }`; MAC sem chave nunca retorna lista.
- Portal publicado: commit `cf5c24beca450086808c73f022f0383a2f489524`.

## Validação executada

- Edge Function: dispositivo inexistente, M3U, Xtream, chave incorreta (403) e dispositivo inativo; os dados temporários foram removidos e a confirmação final retornou zero registros.
- Estática: `node --check` do JavaScript do Portal e `git diff --check`.
- Pendente: TypeScript/bundle local e testes físicos, pois não há dependências Node/Deno instaladas neste ambiente e não foi executado build/APK.
