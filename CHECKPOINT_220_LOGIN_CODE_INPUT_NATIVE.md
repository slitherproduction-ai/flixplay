# Checkpoint 220 — Campo Código seguro para Android

- Base: `2.17.16` (`20261034`), posterior ao checkpoint 219.
- O campo Código preserva o valor nativo enquanto o usuário escreve; não há transformação do texto no evento `onChangeText`.
- O código é normalizado para minúsculas e sem espaços nas extremidades somente no envio para a validação e resolução do Portal, preservando o contrato existente.
- O botão de limpar do Código permanece em TV, mas não é montado em smartphone ou tablet após o primeiro caractere. Isso elimina a alteração de árvore nativa que coincidia com o encerramento reportado.
- Nenhuma credencial IPTV é enviada ao Portal e nenhum fluxo de listas, Portal, player ou licença foi modificado.
