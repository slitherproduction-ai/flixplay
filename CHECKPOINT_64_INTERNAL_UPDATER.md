# Checkpoint 64 — Atualização interna Android

## Entregue

- Verificação automática de novas releases ao abrir o aplicativo, habilitada por padrão.
- Aviso global de nova versão com versão instalada, versão disponível e tamanho do pacote.
- Download interno do APK com indicador de progresso.
- Validação de URL HTTPS, resposta HTTP e tamanho mínimo do arquivo baixado.
- Abertura do instalador nativo Android ao término do download.
- A tela **Sobre** continua oferecendo a verificação manual, agora usando o mesmo download interno.
- Inclusão do módulo `expo-intent-launcher` e da permissão Android necessária para o instalador.

## Segurança e comportamento

- A instalação não é silenciosa: o usuário confirma a atualização no instalador do Android.
- Caso o aparelho bloqueie instalações por fontes externas, o sistema solicitará a autorização correspondente.
- O fluxo é destinado à distribuição direta. Uma versão futura para Google Play deverá usar o mecanismo oficial de atualização da Play Store.

## Validação

- `npx tsc --noEmit` concluído.
- `npm run lint` concluído.
- `npm test -- --runInBand` concluído: 26 suítes e 111 testes aprovados.

## Arquivos alterados

- `services/githubUpdater.ts`
- `components/update-available-notice.tsx`
- `app/_layout.tsx`
- `app/settings/about.tsx`
- `app.json`
- `package.json`
- `package-lock.json`
