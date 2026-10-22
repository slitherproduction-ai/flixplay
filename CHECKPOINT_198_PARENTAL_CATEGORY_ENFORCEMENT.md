# Checkpoint 198 — Aplicação de bloqueio parental por categoria

- Versão: 2.17.16
- Base: checkpoint 197 / commit `530a786a63d899073be17381be7e4189f24aaa75`

## Escopo

- Mantido o fluxo de PIN parental seguro: código padrão `0000`, validação antes de abrir controles, cadeados por categoria e alteração de PIN.
- Canais, Filmes e Séries bloqueados agora encaminham seu identificador de categoria ao player.
- O player valida a categoria recebida antes de iniciar a reprodução, inclusive quando o item não está no cache da tela por causa da paginação.
- A seleção de canal também solicita o PIN imediatamente quando a categoria está bloqueada.

## Preservação

- Nenhuma alteração no player de mídia, listas, favoritos, controle parental por item ou design fora do escopo.
- Nenhum APK foi gerado.

## Validação

- `git diff --check` para os arquivos alterados.
- Inspeção estática dos parâmetros de rota e das guardas de categoria.
- `tools/verify-release-baseline.sh` aprovado no checkout disponível.
- TypeScript e bundle não executados porque as dependências do checkout local não estão instaladas.
