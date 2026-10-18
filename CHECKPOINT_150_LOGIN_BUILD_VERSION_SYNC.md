# Checkpoint 150 — Sincronização da versão exibida no login

**Data:** 18/10/2026  
**Versão de referência:** 2.17.14  
**Checkpoint anterior:** 149  
**Base sincronizada:** `2f0082738768f6a3f79e60372a1a18350c2369e2`

## Correção

A tela de login continha valores-reserva legados (`2.17.8` e build `20261023`). Em ambientes onde as informações nativas não são fornecidas, esses valores eram apresentados mesmo com o aplicativo configurado na versão 2.17.14 e build 20261029.

O login agora utiliza `APP_INFO` como fonte-reserva centralizada. Os valores nativos continuam tendo prioridade quando disponibilizados pela compilação.

## Arquivos alterados

- `app/login.tsx`
- `CHANGELOG.md`
- `CHECKPOINT_150_LOGIN_BUILD_VERSION_SYNC.md`

## Validação executada

- Verificação estática dos valores oficiais em `app.json`, `android/app/build.gradle` e `constants/app.ts`.
- Verificação de diferenças e espaços em branco via Git.

## Pendente

- Compilar pelo fluxo GitHub Actions e confirmar no dispositivo que o rodapé da tela de login mostra `Versão 2.17.14 · Build 20261029`.
