# Checkpoint 219 — Proteção adicional do campo Código

- Base: `2.17.16` (`20261033`), posterior ao checkpoint 218.
- O formulário de login não calcula nem grava handles de foco nativo quando o aparelho não está em modo TV. Isso impede atualizações de estado durante o redimensionamento do teclado em smartphone e tablet.
- `autoFocus`, `hasTVPreferredFocus` e `nextFocus*` são enviados ao `TextInput` somente em Android TV, Google TV e Fire TV.
- A versão visível segue `2.17.16`; o `versionCode` foi elevado para `20261033` em `app.json`, `android/app/build.gradle` e `constants/app.ts`, permitindo instalar este APK sobre builds anteriores.
- Nenhum dado local, fluxo por Código, autenticação Xtream, Portal, player ou listas salvas foi removido ou alterado.
