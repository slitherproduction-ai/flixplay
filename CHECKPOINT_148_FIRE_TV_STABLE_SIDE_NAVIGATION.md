# Checkpoint 148 — Menu lateral estável para Fire TV

## Base

- Versão de referência: `2.17.14` (sem incremento)
- Checkpoint anterior: `147`
- Commit-base: `d5f9b27d77e1b1990574a0b42c8b8e2bc02fc4e2`

## Evidência recebida

- A homologação física confirmou a resolução da tela TV ao Vivo.
- O menu lateral continuou com o problema de informações instáveis/desaparecendo.

## Correção

- O rail da TV deixa de alternar entre 64 px e 216 px sobre a cena.
- O layout passa a reservar permanentemente 216 px para a navegação lateral.
- Ícones, rótulos e versão são renderizados sempre no mesmo plano opaco.
- Removidos `BlurView`, largura condicional e estados de expansão do menu.
- O foco D-pad continua usando os mesmos destinos e limites verticais.

## Arquivos alterados

- `components/tv-side-navigation.tsx`
- `CHANGELOG.md`

## Validação executada

- Revisão estática do plano de composição e foco da navegação TV.
- `git diff --check` aprovado.

## Homologação pendente

- Validar no Fire TV Stick: entrar no menu, percorrer todos os itens e retornar para cada tela sem textos/ícones desaparecerem.
