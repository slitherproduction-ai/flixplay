# Checkpoint 155 — Marca transparente no splash Android

**Data:** 18/10/2026  
**Versão de referência:** 2.17.14  
**Checkpoint anterior:** 154  
**Base sincronizada:** `2fd5d9b2e1a417c1d153d385a6bd03d6f1a57184`

## Correção

O splash nativo utilizava uma imagem com fundo e ícone arredondado já incorporados. Como o Android também apresenta esse asset sobre o fundo da abertura, a marca ficava com bordas escuras, aparência borrada e escala desproporcional.

O splash agora usa exclusivamente o símbolo transparente de alta definição. O fundo sólido `#020714` continua definido pelo Android, sem duplicação de superfícies.

## Arquivos alterados

- `app.json`
- `android/app/src/main/res/drawable-*/splashscreen_logo.png`
- `CHANGELOG.md`
- `CHECKPOINT_155_NATIVE_SPLASH_TRANSPARENT_MARK.md`

## Validação executada

- Conferência do canal alpha e das cinco densidades do recurso nativo.
- Verificação estática da configuração Expo e das diferenças via Git.

## Pendente

- Compilar pelo GitHub Actions e validar a abertura em Android e Fire TV.
