# Checkpoint 15 — Homologação física preparada

Data: 2026-10-07

## Concluído nesta etapa

- Criado o roteiro rastreável `release/HOMOLOGACAO_v2.17.0.md` para dispositivos Android, Android TV/Google TV e Fire TV/Fire Stick.
- Criada a matriz `release/MATRIZ_COMPATIBILIDADE_v2.17.0.md`, distinguindo testes automatizados de homologação comprovada em aparelho real.
- Fechamento automatizado reexecutado com sucesso: 25 suítes / 109 testes, ESLint global e TypeScript sem erros.

## Bloqueadores externos identificados

- Este ambiente não tem `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `sdkmanager` ou `adb`; logo não gera APK nem executa instalação/homologação física.
- A conectividade do servidor de conteúdo testado anteriormente falha no handshake TLS antes da autenticação. O teste físico de login depende de endpoint Xtream válido, com porta, ou correção do certificado pelo provedor.

## Próxima etapa

Executar build Android assinado em ambiente com SDK Android 36 e a chave de assinatura compatível; instalar o artefato nos aparelhos indicados e preencher a homologação com evidências. Após todos os fluxos críticos aprovados, fechar build/release final.
