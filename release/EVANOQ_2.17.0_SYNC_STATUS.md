# EVANOQ 2.17.0 — Status de sincronização

Data: 2026-10-08

## Fonte de verdade
- Arquivo: `ELVANOQ-2.17.0-checkpoint-45-reproducible-arm-build-source-no-secrets.tar.zst`
- SHA-256: `ef5ca5d601e327c00739e003502b4b2f9fae0ac27675105847138bae08ef9a57`
- Contagem: 233 arquivos extraídos, 208 desconsiderando o cache `.expo/`.
- Versão do `package.json` e `app.json`: `2.17.0`
- Android versionCode: `20261015`
- Package: `com.fastshot.slitherproduction.flixplay`
- Fonte `android/`: ausente no checkpoint. Não copiar a pasta da versão 2.13.0 como se fosse build atual.

## Situação do GitHub
A branch principal permanece na antiga versão FlixPlay 2.13.0.
**Esta branch ainda não contém o código 2.17.0.**
O pacote de fontes foi inspecionado localmente, mas não publicado. A ferramenta de transferência do repositório não recebeu sua árvore completa e o Git CLI deste ambiente não alcança o host GitHub.

## Condições para liberar a migração
1. Transferir todos os 208 arquivos de código/documentação (excluindo caches e quaisquer credenciais), preservando nomes e diretórios.
2. Não versionar APK, keystore, senhas, certificados, tokens ou `.env`.
3. Comparar alterações com `main`, evitando regressões nas telas de player, favoritos, parental e trailer.
4. Reconstruir/verificar o projeto Android compatível com Expo 57 e dependências nativas atuais.
5. Rodar testes, build e homologação física em mobile e dispositivos TV.
6. Publicar release somente após as validações.

**Não mesclar o PR nesta situação.**
