# Checkpoint 200 — Login compacto: Listas Salvas

- Versão: 2.17.16
- Base: checkpoint 199 / commit `56984e1a92bdd06674bcda6dcac9f0c056f6bf4b`

## Escopo

- Removido exclusivamente o atalho “Lista M3U” da tela de login.
- “Listas Salvas” passou a integrar o mesmo card dos métodos de conexão, com contador de listas e abertura do modal existente.
- A sincronização de listas do Portal continua disponível dentro de “Listas Salvas”.
- Nenhuma lista M3U salva, fluxo de reprodução, player ou armazenamento foi removido.

## Validação

- Inspeção estática do fluxo de foco e do modal de listas em smartphone, tablet e TV.
- Verificação estrutural remota confirmou a remoção do atalho M3U e a presença de “Listas Salvas” dentro do card de conexão.
- `git diff --check` e baseline de release aguardam um ambiente de execução disponível.
- Nenhum APK ou compilação foi gerado.
