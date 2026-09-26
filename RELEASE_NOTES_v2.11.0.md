# FlixPlay 2.11.0

Build Android: `20261001`

## Nova identidade visual

- Logo horizontal oficial no login e no cabeçalho da Home.
- Novo ícone FlixPlay na tela **Sobre**, no Splash e no launcher.
- Ícones nativos preparados para todas as densidades e máscaras adaptativas do Android.

## Cards no smartphone

- Filmes e séries agora usam três colunas em smartphones, reduzindo o tamanho dos pôsteres e exibindo mais títulos por tela.
- Tablets usam quatro ou cinco colunas, enquanto TVs mantêm de cinco a sete itens conforme a resolução.

## Remoção do Trakt.tv

- A seção foi retirada dos ajustes e da tela **Sobre**.
- A rota, o código de integração e o estado persistido também foram eliminados.

## Compatibilidade

- Android mínimo API 24; alvo 36.
- APK universal com `armeabi-v7a` e `arm64-v8a`.
- Assinado com a mesma chave da versão 2.10.1 para permitir atualização direta a partir dela.

## Segurança

- Conexões Xtream permanecem diretas com o servidor informado pelo usuário.
- Credenciais não são encaminhadas por proxies CORS públicos.

## Validação

- TypeScript concluído sem erros.
- Lint concluído sem avisos.
- 11 testes automatizados aprovados em 5 suítes.
