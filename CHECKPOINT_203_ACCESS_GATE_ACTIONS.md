# Checkpoint 203 — Ações da tela de acesso restrito

Versão: 2.17.16

## Correção

- “Voltar para login” encerra a sessão ativa da lista por código, limpa o estado transitório de bloqueio e navega para o login. A lista continua salva e pode ser selecionada novamente.
- “Verificar novamente” mantém a revalidação de licença e vínculo por MAC e apresenta mensagem de resultado quando o servidor continuar negando o acesso.
- O tratamento não remove listas, não altera credenciais e não afeta player, favoritos ou controle parental.

## Validação

- Inspeção estática dos handlers: retorno limpa servidor ativo e bloqueio antes de mudar de rota; verificação mantém a consulta existente e apresenta resultado.
- Teste físico em smartphone/TV pendente de nova compilação.
