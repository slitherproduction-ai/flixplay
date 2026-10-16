# Proteções de release — ELVANOQ

Este documento define a base mínima antes de uma geração de APK.

## Regra de versão

`package.json`, `app.json`, `android/app/build.gradle` e `constants/app.ts`
devem declarar a mesma versão. `app.json` e Gradle devem declarar o mesmo
`versionCode`.

## Ajustes obrigatórios de TV / Fire TV

- Tela TV ao Vivo em três painéis: categorias, canais e preview/guia.
- Lista de canais com fonte de 12 px e EPG com fonte de 10 px no modo TV.
- Preview desmontado ao perder foco da aba TV ao Vivo, sem áudio residual.
- EPG atualizado em lote, com no máximo duas requisições concorrentes.
- Paginação de catálogo ativa para manter a janela de dados reduzida.
- Abas inativas congeladas no modo TV.
- Menu lateral mantém os destinos visíveis enquanto está expandido e sob foco.

## Porta de saída

Antes de gerar um APK, executar:

```bash
./tools/verify-release-baseline.sh
./tools/verify-android-build-env.sh
npx tsc --noEmit
npm test -- --runInBand
npm run lint
```

O script `tools/build-android-universal.sh` executa a verificação de baseline
antes de iniciar o Gradle, reaplica a compatibilidade offline dos módulos
nativos e monta o índice Maven local a partir do cache persistente. Uma falha
em qualquer item interrompe o processo antes da criação de um artefato.

## Limites da validação

Essas proteções validam a fonte e o ambiente local. A aprovação final ainda
exige teste físico em smartphone e Fire TV/Fire Stick, incluindo navegação
D-pad, troca de abas, preview com áudio, encerramento do preview e estabilidade
com uma lista grande de canais.
