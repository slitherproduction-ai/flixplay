# Checkpoint 185 — Resumo de conta na tela inicial

## Base

- Versão de desenvolvimento: **2.17.16**.
- Versão de runtime preservada: **2.17.15** (build `20261030`).
- Checkpoint anterior: **184**.

## Implementação

- Substituída a ação de pesquisa do canto superior da tela inicial por um resumo compacto da conta.
- O resumo apresenta avatar pela inicial, nome personalizado da lista (ou usuário como alternativa) e a data de expiração disponível no perfil ativo.
- O mesmo componente responsivo é usado em TV, smartphone e tablet, com escala e tipografia compactas por plataforma.
- A seleção do bloco leva para Ajustes, preservando acesso à administração da conta.

## Arquivos

- `app/(tabs)/index.tsx`
- `CHANGELOG.md`

## Validação prevista

- Verificação de sintaxe/diff e de referências removidas da lupa na Home.
- Sem geração de APK ou build Android neste ambiente.
