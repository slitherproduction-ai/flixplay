# FlixPlay 2.10.1

Build Android: `20260930`

## Correções

- Aviso de saída totalmente visível e responsivo em smartphones, inclusive em paisagem.
- Botões de confirmação com largura estável e conteúdo sem recortes.

## Home

- Removido o cartão com nome do servidor e validade da conta.
- O avatar passa a usar a identificação neutra `FP`.

## EPG antes da reprodução

- A programação atual é carregada nos canais em destaque da Home.
- Os primeiros canais da tela TV ao Vivo são carregados automaticamente.
- Canais que entram na área visível durante a rolagem recebem o EPG sem abrir o player.
- Cache de cinco minutos, deduplicação e limite de quatro requisições simultâneas evitam sobrecarga do servidor.

## Limpeza

- Removidos recursos gráficos do template, mockups e anexos de desenvolvimento sem referência no aplicativo.
- Código e estilos exclusivos do antigo cartão de servidor também foram excluídos.

## Compatibilidade

- Android mínimo API 24; alvo 36.
- APK universal com `armeabi-v7a` e `arm64-v8a`.

## Segurança

- Conexões Xtream permanecem diretas com o servidor informado pelo usuário.
- Credenciais não são encaminhadas por proxies CORS públicos.

## Validação

- TypeScript concluído sem erros.
- Lint concluído sem erros.
- 11 testes automatizados aprovados em 5 suítes.

## Observação de instalação e distribuição

A chave privada usada no APK 2.10.0 não estava presente na cópia recuperada do projeto. O APK 2.10.1 foi assinado com uma nova chave de desenvolvimento preservada no pacote de recuperação; portanto, pode ser necessário desinstalar a versão anterior antes de instalar esta versão. Para publicação em loja, use uma chave definitiva e preserve-a em todas as atualizações.
