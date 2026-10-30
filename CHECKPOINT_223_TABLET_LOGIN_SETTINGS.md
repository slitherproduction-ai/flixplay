# Checkpoint 223 — Tablet, Login e Ajustes

## Base

- Versão de desenvolvimento: **2.17.16**.
- Checkpoint anterior: **222**.

## Tablet na horizontal

- `TvCatalogBrowser` e `TvDetailsContent` atendem também o toque: sem menu lateral, áreas seguras, linhas de categoria de 40 dp, título sob o pôster, sem dicas de controle remoto, botão Voltar nos Detalhes e botões de 46 dp.
- Ativados por `tvMode || isTabletLandscape` em Filmes, Séries e Detalhes.

## Login

- Correção: reconexão de lista salva exibia carregamento e erro somente no formulário; na tela de métodos ficavam invisíveis.
- TV: foco inicial em Listas Salvas quando há listas; painel abre com foco na lista ativa.
- Celular: rolagem automática até a mensagem de erro.
- Tablet na horizontal: fundo largo da TV.
- Erros são limpos ao trocar de método.

## Ajustes e dependências

- Host/DNS não é exibido nas listas (código, usuário mascarado e validade).
- Status traduzido e com cor coerente; validade e conexões em uso/limite.
- TV: cartão da conta no topo do painel.
- Sem alerta ao iniciar "Atualizar lista".
- Adicionar servidor usa `checkXtreamAuth`, `getUserStatusError`, `buildProfileUpdate` e `mapConnectError`.
- Insets superiores (edge-to-edge) em Ajustes, Player, Parental, Diagnóstico, Sobre, Adicionar servidor, Filmes/Séries (celular) e Detalhes (celular).

## Recomendações não aplicadas

- Preenchimento automático de usuário/senha (`autoComplete`) no Login: adiado pelo histórico de instabilidade com teclados Samsung/Fire OS (CP 218–220); validar em aparelho antes.
- Trocar de lista em Ajustes não atualiza o Host de listas por código como o Login faz; a licença é revalidada pelo `CodeAccessGate` na troca, mas o DNS só é renovado ao reconectar pelo Login.

## Validação

- Verificação de sintaxe TypeScript dos arquivos alterados.
- Pendente: `npx tsc --noEmit`, `npm test -- --runInBand`, `npm run lint` e teste físico (Fire TV, tablet nas duas orientações, smartphone com teclado Samsung).
