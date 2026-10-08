# Checkpoint 35 — Sessão segura persistente

## Problema corrigido

Em builds Android de produção, o armazenamento de estado apontava para o
módulo nativo `FlixPlaySecureStorage`. Esse módulo não era registrado pelo
projeto Expo gerado. A leitura da sessão, portanto, falhava a cada abertura e
a tela de recuperação solicitava um novo login.

## Alterações

- Substituído o módulo inexistente por `expo-secure-store`, que utiliza o
  Android Keystore.
- Mantida a chave de estado já utilizada (`app-storage`).
- Preservada a migração da cópia legada: ela só é removida depois da gravação
  criptografada e de uma leitura de confirmação.
- Falhas transitórias de leitura não descartam uma sessão legada existente nem
  exibem a tela de recuperação prematuramente.
- Adicionada a dependência `expo-secure-store` compatível com Expo SDK 57.

## Validação

- `npx tsc --noEmit`: aprovado.
- `EXPO_NO_TELEMETRY=1 npm run lint`: aprovado.
- `npm test -- --runInBand`: 26 suítes e 111 testes aprovados.

## Efeito para instalações atuais

A atualização preserva e migra sessões legadas quando presentes. Instalações
em que a versão defeituosa nunca conseguiu gravar a sessão exigirão um último
login; após isso, as próximas aberturas usam o Android Keystore normalmente.
