# FlixPlay

Aplicativo para TV ao vivo, filmes e séries, desenvolvido com Expo e React Native. O projeto inclui navegação por controle remoto, reprodução de conteúdo, listas Xtream e uma versão Android para Fire TV.

## Versão atual

- **2.10.0** — código de versão Android `20260929`.
- Pacote Android: `com.fastshot.slitherproduction.flixplay`.
- APK universal compilado para `armeabi-v7a` e `arm64-v8a`; SDK mínimo 24.
- A tela **Sobre** mostra os dados da versão instalada e o histórico recente de versões.

## Novidades da 2.10.0

- Home de TV com 5–7 títulos visíveis por linha, foco 1,05x e navegação D-Pad.
- OSD com auto-hide configurado em 4 segundos e animação de fade-out.
- Máquina de estados exclusiva para OSD, Zapping Rápido, EPG e Cast.
- A tecla Voltar fecha primeiro a camada ativa e, depois, solicita confirmação de saída.
- Mantidos o PiP nativo, EPG real e progresso real de filmes e episódios da versão 2.9.0.

## Desenvolvimento

```bash
bun install
npx expo start
```

O arquivo `bun.lock` fixa as dependências. O projeto Android é gerado a partir de `app.json` e dos plugins em `plugins/`.

## Compilar Android

Instale JDK 17, Android SDK 36, Build Tools, NDK 27.1.12297006 e CMake 3.22.1. Configure `ANDROID_HOME` e `ANDROID_SDK_ROOT` para o SDK local e execute:

```bash
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a
```

O arquivo gerado fica em `android/app/build/outputs/apk/release/app-release.apk`. O repositório não inclui SDK, dependências instaladas, cache de compilação, chaves privadas ou arquivos locais. O build gerado usa a chave de desenvolvimento do Android; para distribuição contínua, configure uma chave de assinatura própria e mantenha a mesma chave nas próximas versões. Um APK assinado com chave diferente não atualiza uma instalação existente sem reinstalação.

## Atualizações pelo aplicativo

O verificador consulta a [última GitHub Release](https://github.com/slitherproduction-ai/flixplay/releases/latest) e procura um APK anexado à publicação. O código no repositório, por si só, não disponibiliza um instalador ao verificador. Para distribuir uma versão pelo aplicativo, publique uma Release com a tag correspondente à versão e anexe o APK assinado com a mesma chave da instalação anterior.

Use somente listas e conteúdos para os quais você tenha autorização de acesso e reprodução.
