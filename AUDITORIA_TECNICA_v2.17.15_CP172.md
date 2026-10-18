# Auditoria técnica — ELVANOQ Play 2.17.15

Data: 2026-10-18  
Escopo: revisão estática do código e configuração disponível no checkpoint 171, sem build Android ou APK.

## Resultado executivo

O aplicativo possui uma base sólida para Android, Android TV, Google TV e Fire TV: separa comportamento de TV com `useTVMode`, usa listas virtualizadas nas grades de catálogo e canal, possui cache paginado, tratamento de recuperação e uma bateria de testes automatizados.

Não houve evidência estática de regressão de responsividade nas telas principais. A validação visual e de fluidez em dispositivos físicos continua obrigatória, em especial no Fire TV Stick e em smartphones de largura reduzida.

## Responsividade

### Pontos positivos

- Filmes, Séries, TV ao Vivo, Login e Início usam `useWindowDimensions` ou `useTVMode` para adaptar densidade e layout.
- Grades de Filmes, Séries e canais selecionam o número de colunas pela largura disponível.
- TV ao Vivo calcula a largura das três áreas a partir do viewport e reserva espaço para a navegação lateral.
- As listas grandes usam `FlatList`, paginação, `windowSize`, lotes de renderização e `removeClippedSubviews` em Android.
- Login prevê layout compacto para TVs de 720p.

### Riscos a homologar fisicamente

- Confirmar em 720p e 1080p que o painel de preview/EPG e os três painéis da TV ao Vivo mantêm leitura e foco sem corte.
- Confirmar em smartphones com largura abaixo de 360 dp que Login, detalhes e cards de episódios não tenham quebra de ação ou texto.
- Confirmar em telas grandes que o foco da navegação lateral não soma margem visual indevida ao conteúdo.

## Fluidez e memória

### Pontos positivos

- TV ao Vivo atrasa a troca do preview ao percorrer linhas e não pré-carrega EPG de toda a lista em modo TV.
- A sincronização usa cancelamento por `AbortController`, proteção contra concorrência e cache local paginado.
- Player libera o preview de TV ao Vivo ao perder foco e mantém temporizadores em referências para limpeza.

### Prioridades de melhoria

1. Dividir `app/player.tsx`, `app/details/[id].tsx`, `app/login.tsx`, `app/(tabs)/live.tsx` e `app/settings/about.tsx`. São os cinco maiores arquivos e concentram estado, UI e regras de negócio, elevando o risco de regressões.
2. Medir tempo de primeira abertura, troca de canal, memória e frames em Fire TV Stick com catálogos de 5 mil, 20 mil e 30 mil itens. A análise estática não substitui telemetria física.
3. Adicionar testes de regressão para foco do rail lateral, preview/EPG e seleção de temporada, pois são fluxos que dependem de comportamento nativo de TV.

## Segurança e qualidade

- TypeScript está configurado com `strict: true`.
- ESLint possui regras específicas para armadilhas de Zustand e APIs ausentes no Hermes.
- Há 27 arquivos de teste e 103 casos identificados estaticamente.
- A tela global de recuperação apresenta a mensagem bruta da exceção. Recomenda-se exibir uma mensagem genérica ao usuário e manter o detalhe apenas no diagnóstico técnico, para não expor URLs, tokens ou implementações.

## Limpeza executada

Os itens abaixo foram verificados sem referências em rotas, componentes, testes ou configuração e removidos:

- `components/catalog-hero.tsx` — componente sem importações.
- `data/demo.ts` — dados e stream de demonstração sem importações.
- `assets/images/brand/ELVANOQ_login_mobile_backdrop_v3.jpg`.
- `assets/images/brand/ELVANOQ_login_tv_backdrop_v2.jpg`.
- `assets/images/brand/ELVANOQ_login_tv_backdrop_v3.jpg`.

Os fundos v4 são os únicos usados pelo login atual.

## Dependências que exigem validação antes de remoção

Foram encontradas dependências sem importação direta de código de aplicativo, porém elas não foram removidas porque podem participar do Expo, plugin de configuração ou destino web: `@radix-ui/react-dialog`, `expo-haptics`, `expo-linking`, `expo-symbols`, `react-dom`, `react-native-svg`, `react-native-web`, `react-native-webview` e `react-native-worklets`.

`@react-native-community/datetimepicker` permanece necessário como plugin declarado no `app.json`.

## Validações realizadas

- Varredura de referências de código, assets e dados de demonstração.
- Verificação de duplicidade de arquivos por hash.
- `git diff --check` aprovado.
- `tools/verify-release-baseline.sh` aprovado para versão `2.17.15`, build `20261030`.

## Não executado neste ambiente

- `tsc`, lint, Jest e bundle Expo: dependências `node_modules` não estão instaladas neste checkout.
- Build Android/APK e homologação física: fora do escopo desta auditoria.
