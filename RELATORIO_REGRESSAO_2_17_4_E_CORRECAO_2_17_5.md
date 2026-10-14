# Relatório de regressão 2.17.4 e correção 2.17.5

## Resultado

O `2.17.5` foi reconstruído a partir do último código-fonte funcional
(`2.17.2`, Checkpoint 90), com a alteração visual de login reaplicada de forma
isolada. O APK resultante é universal (`arm64-v8a` e `armeabi-v7a`), assinado
e identificado como `2.17.5` / build `20261020`.

## Erros encontrados no 2.17.4

1. **Mudança nativa fora da base homologada.** O `package.json` do 2.17.4
   excluía `@expo/ui` do autolinking Android. Essa exclusão não existia no
   2.17.2 funcional e foi introduzida como tentativa de contornar uma falha de
   compilação. Ela foi removida.
2. **Rastreabilidade de versão incoerente.** Manifesto e tela Sobre indicavam
   versões diferentes da constante interna do aplicativo. No 2.17.5,
   `package.json`, `app.json`, Gradle, `constants/app.ts`, histórico interno e
   nome do APK usam a mesma versão e build.
3. **Validação de release incompleta.** O 2.17.4 foi aceito após montagem e
   assinatura, sem a comparação final com a base estável e sem uma etapa de
   inicialização em dispositivo/emulador. A matriz de regressão passa a ser
   obrigatória antes da publicação.
4. **Build frágil por memória de lint.** Na primeira montagem limpa do 2.17.5,
   o lint Android esgotou a metaspace. A memória do Gradle foi ajustada para
   `-Xmx2048m` e `MaxMetaspaceSize=1024m`; a montagem seguinte foi concluída.

## Checkpoints restaurados e verificados

| Checkpoint | Entrega preservada | Verificação |
| --- | --- | --- |
| 80 | Marca ampliada no login e remoção do texto promocional | Fonte preservada na base 2.17.2 |
| 86 | Busca, player com áreas seguras, ações de série e base correta do CP80 | Fonte preservada na base 2.17.2 |
| 87 | Trilho lateral/foco da TV e Home compacta | `tv-navigation.test.ts` aprovado |
| 88 | Guia TV, filtros azuis, prévia e carregamento de EPG por foco | `hydrate-paged-channels.test.ts` e `epg.test.ts` aprovados |
| 90 | OSD por OK/Enter/Seta para cima e navegação D-Pad | `player-runtime.test.ts`, `player-config.test.ts` e `tv-navigation.test.ts` aprovados |

## Alteração visual solicitada

- Substituídos os círculos azuis do login pelos fundos cinematográficos:
  `ELVANOQ_login_mobile_backdrop_v3.jpg` no smartphone e
  `ELVANOQ_login_tv_backdrop_v3.jpg` na TV.
- O bundle do APK contém referência aos dois recursos.

## Validações concluídas

- `tsc --noEmit`: aprovado.
- Jest: 6 suítes, 20 testes aprovados.
- Montagem Android release: aprovada.
- Assinatura APK v2: aprovada.
- Manifesto: pacote `com.fastshot.slitherproduction.flixplay`, versão `2.17.5`,
  build `20261020`, `minSdk 24`, `targetSdk 36`.
- Arquiteturas: `arm64-v8a` e `armeabi-v7a`.

## Limite da validação

Este ambiente não possui um dispositivo Android ou emulador disponível para
executar o APK. A validação de inicialização em aparelho ainda deve ser feita
na instalação; qualquer falha deve ser acompanhada de `logcat` para análise
imediata antes de um novo release.
