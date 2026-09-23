# FlixPlay

Aplicativo para TV ao vivo, filmes e séries, desenvolvido com Expo e React Native. O projeto inclui navegação por controle remoto, reprodução de conteúdo, listas Xtream e uma versão Android para Fire TV.

## Versão atual

- **2.9.0** — código de versão Android `20260928`.
- Pacote Android: `com.fastshot.slitherproduction.flixplay`.
- APK universal compilado para `armeabi-v7a` e `arm64-v8a`; SDK mínimo 24.
- A tela **Sobre** mostra os dados da versão instalada e o histórico recente de versões.

## Novidades da 2.9.0

- Zapping rápido com seleção de categoria, favoritos e grade de canais ao vivo.
- Picture-in-picture nativo do Android em smartphones compatíveis.
- EPG real do provedor Xtream, com programa atual e próximo na barra do player.
- Progresso real e retomada de filmes e episódios em **Continuar assistindo**.

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
