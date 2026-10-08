# Migrações — FlixPlay 2.15.0

## Banco de dados

- O schema do catálogo evolui de forma aditiva para a versão 2.
- Novos índices cobrem servidor, tipo, categoria, nome normalizado, número do canal e atualização.
- Catálogos existentes não são apagados antes de uma substituição válida.
- Falhas em transações preservam o último catálogo confirmado.

## Credenciais

- Credenciais legadas continuam sendo migradas para o cofre seguro.
- A cópia antiga só deve ser removida depois da gravação segura confirmada.
- Exclusão de uma lista remove também seu segredo; “Excluir todas” limpa todos os segredos associados.

## Compatibilidade e rollback

- Package preservado: `com.fastshot.slitherproduction.flixplay`.
- Version code: `20261006`.
- Min SDK: 24.
- O downgrade direto pode ser recusado pelo Android. O plano seguro é interromper o rollout e reinstalar a 2.14.0 apenas quando a preservação de dados tiver sido validada.

As migrações precisam ser homologadas fisicamente sobre 2.12.1, 2.13.0 e 2.14.0 antes de lançamento público.
