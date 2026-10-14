# Checkpoint 93 — Correção da regressão 2.17.4

## Base de reconstrução

- Base funcional: `2.17.2`, checkpoint 90.
- Recursos preservados: checkpoints 80, 86, 87, 88 e 90.
- Alteração visual reaplicada: fundos cinematográficos de login para smartphone e TV.

## Correções aplicadas

- Removida a configuração de autolinking que excluía `@expo/ui` no Android.
- Removidas as mudanças de Gradle introduzidas no 2.17.4; a configuração volta a ser a da base homologada.
- Aumentada somente a memória de compilação do Gradle para evitar falha de metaspace no lint de release.
- Removidos os círculos azuis decorativos do login.
- Sincronizados `package.json`, `app.json`, `android/app/build.gradle`, `constants/app.ts`, histórico interno e nome do APK para `2.17.5` / build `20261020`.

## Critério de publicação

O APK só pode ser publicado após verificação de tipos, testes, montagem limpa, inspeção do manifesto, assinatura e inicialização em dispositivo/emulador Android.
