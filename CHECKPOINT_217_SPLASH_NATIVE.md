# Checkpoint 217 — Splash nativo ELVANOQ

- Base: `2.17.16` (`20261032`), posterior ao checkpoint 216.
- Fundo nativo do splash alterado para `#03070f`.
- O splash passa a usar o símbolo branco transparente fornecido, centralizado e redimensionado para todas as densidades Android.
- Os cinco recursos foram gerados no quadro nativo recomendado de `108dp` (`108`, `162`, `216`, `324` e `432` px). O Android deixa de ampliar um bitmap de `48dp`, que era a origem do aspecto borrado.
- Os recursos nativos em `drawable-mdpi` até `drawable-xxxhdpi` foram atualizados diretamente porque o workflow de release monta o projeto Android existente sem executar `expo prebuild`.
