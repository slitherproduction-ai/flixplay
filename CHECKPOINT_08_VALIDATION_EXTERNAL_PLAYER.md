# Checkpoint 08 — Validação e player externo

Data: 2026-10-05

## Concluído

- TypeScript: aprovado.
- Lint dos arquivos alterados: aprovado.
- Jest: 22 suítes e 101 testes aprovados.
- Corrigido o fluxo assíncrono da limpeza da busca para atender à regra de
  efeitos do React.
- Integrado o botão **Abrir no player externo** ao player. Ele pausa o player
  interno, tenta abrir um app Android compatível e apresenta erro seguro se
  não houver app disponível ou a ação falhar.

## Pendências conhecidas

- O lint global ainda aponta problemas preexistentes fora deste ciclo,
  principalmente em `inspector-overlay.js`, hooks de EPG e algumas telas de
  ajustes. Eles não foram suprimidos nem marcados como aprovados.
- A compilação Android chegou à configuração de projeto, mas não pode criar o
  APK neste ambiente porque não há Android SDK nem `sdkmanager` instalado e a
  variável `ANDROID_HOME` não está definida.
- Homologação física continua pendente em smartphone, Android TV e Fire TV.

## Próxima sequência automática

1. Disponibilizar Android SDK API 36 e apontar `ANDROID_HOME` ou `sdk.dir`.
2. Executar `lintRelease`, `lintVitalRelease`, APK debug e release assinado.
3. Homologar PIN parental, player externo, D-Pad/zapping, PiP e atualização
   em dispositivos reais.
