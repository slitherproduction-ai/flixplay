# Relatório técnico — FlixPlay 2.14.0

## Identificação

- Package: `com.fastshot.slitherproduction.flixplay`
- Version name: `2.14.0`
- Version code: `20261005`
- Min SDK: `24`
- Target/Compile SDK: `36`
- Gradle: `9.3.1`
- ABIs: `armeabi-v7a`, `arm64-v8a`

## Alterações implementadas

- Criado módulo tipado de configuração do player, separado da tela visual.
- Preferências persistentes de OSD, salto, formato de stream e User-Agent.
- Cabeçalho User-Agent sanitizado antes de ser enviado.
- Ordem de fallback HLS/TS aplicada conforme a preferência do usuário.
- Entrada numérica de canal com limite de quatro dígitos e confirmação após 1,5 segundo.
- Mapeamento de CH+/CH- e teclas coloridas, mantendo fallback para setas D-Pad.
- Trocas rápidas agrupadas em janela de 120 ms para evitar condições de corrida.
- Indicador de buffering ativado durante troca, fallback e nova tentativa.
- Histórico visual reduzido às duas versões mais recentes.

## Validação executada

- TypeScript: aprovado (`npx tsc --noEmit`).
- ESLint/Expo lint: aprovado.
- Jest: 10 suítes, 28 testes aprovados.
- Android lint vital: aprovado durante `assembleRelease`.
- Build release com Gradle 9.3.1: aprovado.
- Assinatura APK Signature Scheme v2: verificada.
- Package, versão, SDKs e arquiteturas: verificados com ferramentas Android SDK.

## Assinatura e integridade

- Certificado SHA-256: `0e74497b842b0fac4524cd2b194fc348857a17ffc177dd934a6823f9b8e599f7`
- APK SHA-256: `76edecee927e4512172e7dae63f1ff19a4f5bf7de41066c21ba3517c51f22b82`

O certificado é o mesmo usado no APK 2.13.0 preservado, permitindo atualização direta nas instalações compatíveis.

## Limitações e adiamentos

- VLC e player nativo não foram exibidos como opções porque não há motores adicionais integrados; manter seletores decorativos violaria a regra de funções reais.
- Buffer manual e sincronização de áudio/legenda não foram expostos porque `expo-video` não oferece APIs estáveis para essas alterações nesta base.
- Botões coloridos dependem do firmware do controle enviar os códigos padrão; CH+/CH- e D-Pad continuam disponíveis como alternativas.
- A homologação física em modelos reais de Fire TV/Android TV ainda deve ser executada.

## Rollback

1. Preserve os dados do aplicativo.
2. Instale um APK anterior assinado com o mesmo certificado somente se o Android aceitar downgrade via ADB com a opção apropriada; instalação comum normalmente bloqueia versionCode inferior.
3. Se for indispensável reinstalar, exporte/anote as listas antes, pois a desinstalação remove dados locais.
4. Para um rollback distribuível sem ADB, gere a base anterior com `versionCode` superior e a mesma assinatura.
