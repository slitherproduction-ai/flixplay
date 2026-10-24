# Checkpoint 210 — endereço do Portal no login

## Escopo

Expõe no rodapé de identidade da tela de login o destino de cadastro do
ELVANOQ Play: `elvanoqplay.app`.

## Preservação

- A origem continua centralizada em `constants/portal.ts`.
- Nenhum endpoint Supabase, host IPTV, credencial, MAC ou chave foi alterado.
- O texto continua compatível com smartphone, tablet e TV, inclusive a versão
  compacta exibida na TV.

## Validação prevista

- Verificação de diferenças sem whitespace incorreto.
- Baseline de release 2.17.16 / versionCode 20261031.
