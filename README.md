# ELVANOQ

Aplicativo Android de streaming para listas próprias e autorizadas, com suporte a **TV ao vivo, filmes e séries**. O projeto é construído com Expo, React Native e Expo Router, com uma experiência adaptativa para smartphone, Android TV, Google TV, Fire TV e Fire Stick.

> O ELVANOQ não fornece conteúdo, listas ou credenciais. Use somente fontes para as quais você tenha autorização de acesso e reprodução.

## Versão atual

| Item | Valor |
| --- | --- |
| Versão | `2.17.16` |
| Build / versionCode | `20261031` |
| Pacote Android | `com.fastshot.slitherproduction.flixplay` |
| Android mínimo | API 24 |
| Arquiteturas do APK universal | `armeabi-v7a`, `arm64-v8a` |
| Último APK validado | `ELVANOQ-v2.17.14-universal.apk` — compilação 2.17.16 pendente |

O histórico completo está em [CHANGELOG.md](CHANGELOG.md). A tela **Sobre** e o rodapé de login exibem a versão e o build instalados.

## Principais recursos

- Conexão por **Código do servidor + Xtream**, **Xtream por Host** ou importação de **M3U/M3U Plus**, com XMLTV opcional. O código consulta somente o Host/DNS no Portal; usuário e senha seguem apenas ao servidor IPTV.
- Catálogo de TV ao vivo, filmes e séries, incluindo busca, favoritos, bloqueios, assistir mais tarde e continuar assistindo.
- Guia de TV ao vivo responsivo: lista de canais à esquerda e preview/EPG à direita no modo TV.
- Preview com áudio apenas enquanto a guia TV ao vivo está ativa; ao sair da tela, a reprodução é pausada.
- Player com HLS/TS, áudio e legendas, OSD, troca rápida de canais, escolha de proporção, PiP no Android e preferência de formato de stream.
- Metadados complementares do TMDB quando configurado para o build.
- Controle parental, diagnóstico de conexão, cache local por servidor e relatório técnico sanitizado.
- Interface responsiva: navegação inferior para toque e menu lateral retrátil com D-pad para TV.
- Tratamento visual premium com imagens full-bleed, degradês cinematográficos e Glass Blur apenas nas superfícies de vidro.

## Estrutura do projeto

| Caminho | Responsabilidade |
| --- | --- |
| `app/` | Rotas, telas e fluxos da aplicação (Expo Router) |
| `components/` | Componentes reutilizáveis, foco de TV e menu lateral |
| `services/` | Xtream, M3U, XMLTV, TMDB, player externo e atualizador |
| `hooks/` | Sincronização de catálogo, EPG, paginação e controle remoto |
| `store/` | Estado persistente da aplicação com Zustand |
| `plugins/` | Configuração nativa Android, TV e arquiteturas ARM |
| `tools/` | Preparação/verificação do ambiente e build universal |
| `__tests__/` | Testes automatizados Jest |
| `android/` | Projeto Android nativo gerado/configurado para release |

## Requisitos de desenvolvimento

- Node.js compatível com Expo 57 e npm.
- JDK 17 completo (com `javac`) para builds Android.
- Para builds nativos: Android SDK API 36, Build Tools 36.0.0, NDK 27.1.12297006 e CMake 3.22.1.
- Uma credencial de leitura do TMDB somente quando desejar incluir metadados TMDB no APK de produção.

Instale as dependências com o lockfile versionado:

```bash
npm ci
```

## Executar em desenvolvimento

```bash
npx expo start
```

Use o cliente/dispositivo compatível indicado pelo Expo. A identificação de Android TV é automática; em outros dispositivos, o modo TV pode ser habilitado nas preferências do player para validar a navegação por controle remoto.

## Configuração local

Crie um arquivo `.env` local, que não deve ser versionado:

```dotenv
EXPO_PUBLIC_TMDB_ACCESS_TOKEN=seu_token_de_leitura_do_tmdb
```

O token é opcional durante o desenvolvimento da interface, mas o script de release o valida antes de criar o APK para impedir uma distribuição sem os metadados configurados. Nunca registre esse valor no Git, no README ou em relatórios.

As conexões Xtream, M3U e XMLTV são configuradas pelo próprio aplicativo.

## Sincronização com o Portal ELVANOQ Play

Uma lista M3U ou Xtream cadastrada no Portal pode ser trazida para **Listas Salvas** sem substituir as listas locais nem mudar a lista ativa. A consulta é realizada ao abrir/retornar ao login, ao abrir **Listas Salvas** e pelo botão **Atualizar**.

- O aplicativo consulta somente a lista associada ao seu próprio MAC e à chave do dispositivo.
- Se a lista foi cadastrada no Portal sem chave, o Portal exibe uma chave gerada uma única vez. No aplicativo, abra **Listas Salvas → Vincular chave** e informe-a. Essa operação é explícita e não altera a chave local mostrada no login.
- Credenciais de playlist permanecem no armazenamento protegido do aparelho e não são exibidas na lista salva. Sem conexão com o Portal, as listas que já estavam salvas continuam disponíveis.
- A sincronização não seleciona, reproduz nem troca a lista ativa automaticamente.

## Migração de instalações anteriores

Após uma atualização, o aplicativo restaura primeiro o estado persistido de versões anteriores e só então executa, em segundo plano, a migração de identidade para o Portal.

- Listas Xtream, M3U e por código, credenciais protegidas, favoritos, histórico, progresso e preferências não são alterados nem enviados ao Portal.
- Versões anteriores não possuíam uma identidade do Portal reutilizável. Nesses casos o app cria uma identidade local uma única vez e a mantém em armazenamento seguro; ela não é recriada em cada abertura.
- O Portal confirma a migração apenas para o mesmo par MAC/chave. Conflitos de chave exigem redefinição autorizada pelo administrador; o aplicativo nunca troca a chave silenciosamente.
- O endpoint de migração não cria teste, não concede licença, não reinicia validade e não processa pagamentos. Sem correspondência comprovada, o dispositivo fica como **regularização pendente** no Portal, enquanto as listas locais continuam preservadas. A reativação explícita pelo administrador/responsável marca o vínculo como verificado.
- A operação não envia URL M3U, Host, usuário ou senha. A sincronização de listas do Portal continua sendo o fluxo explícito já documentado acima.
- Falhas de rede, limite de requisições ou indisponibilidade deixam os dados locais intactos e são tentadas novamente com intervalo progressivo. A migração só é marcada como concluída após confirmação do Portal.

## Qualidade

Execute antes de abrir uma revisão ou gerar uma release:

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run lint
```

Na validação da versão `2.17.13`, TypeScript foi aprovado e os testes automatizados concluíram com **27 suítes / 113 testes**. A validação estática não substitui os testes físicos em smartphone, Android TV, Fire TV e Fire Stick.

## Compilar APK universal

O projeto possui um script de build que confere os pré-requisitos, exige a configuração TMDB, utiliza caches locais e gera um APK ARM universal.

1. Prepare o SDK, NDK, JDK e cache local conforme [ANDROID_COMPILER_ENVIRONMENT.md](ANDROID_COMPILER_ENVIRONMENT.md).
2. Opcionalmente, carregue o ambiente persistente local:

   ```bash
   source tools/activate-android-build-env.sh
   ```

3. Verifique o ambiente e execute a montagem:

   ```bash
   ./tools/verify-android-build-env.sh
   npm run android:universal
   ```

O resultado da versão atual é gravado em:

```text
release/ELVANOQ-v2.17.13-universal.apk
```

O script executa o Gradle em modo offline e usa, por padrão, `android-sdk/` e `.build-cache/` ao lado do código-fonte. Para reutilizar cache em outro local persistente, defina `ELVANOQ_BUILD_CACHE` antes do build. Detalhes adicionais estão em [BUILD_APK_UNIVERSAL.md](BUILD_APK_UNIVERSAL.md).

### Assinatura e atualização

O build local usa a configuração de assinatura disponível no ambiente Android. Para distribuir atualizações sobre uma instalação existente, mantenha sempre a **mesma chave de assinatura**. Um APK assinado por outra chave não atualiza o aplicativo instalado; será necessário desinstalar a versão anterior.

Antes de distribuir, valide pelo menos:

```bash
unzip -t release/ELVANOQ-v2.17.13-universal.apk
apksigner verify --verbose release/ELVANOQ-v2.17.13-universal.apk
```

## Atualização dentro do aplicativo

O verificador consulta a [última GitHub Release](https://github.com/slitherproduction-ai/flixplay/releases/latest) e procura um APK anexado. Apenas enviar código ao repositório não disponibiliza uma atualização.

Para publicar uma versão:

1. Gere e valide o APK assinado.
2. Crie uma GitHub Release com tag compatível com a versão publicada.
3. Anexe o APK da release.
4. Preserve a chave de assinatura já usada pelos dispositivos instalados.

## Testes físicos recomendados

Em cada release, valide em aparelho real:

- Login via Xtream e importação M3U/XMLTV.
- Navegação touch em smartphone e D-pad em Android TV/Fire TV/Fire Stick.
- Foco/expansão do menu lateral sem sumiço de ícones ou rótulos.
- Guia TV ao vivo, áudio do preview e interrupção do áudio ao sair da tela.
- Player, OSD, áudio, legendas, PiP e retorno da reprodução.
- Atualização sobre uma instalação anterior com a mesma assinatura.

## Documentação relacionada

- [Changelog](CHANGELOG.md)
- [Ambiente de compilação Android](ANDROID_COMPILER_ENVIRONMENT.md)
- [Build universal](BUILD_APK_UNIVERSAL.md)
- [Validação da v2.17.13](ELVANOQ-v2.17.13-VALIDACAO.md)
- [Changelog da v2.17.13](ELVANOQ-v2.17.13-CHANGELOG.md)
