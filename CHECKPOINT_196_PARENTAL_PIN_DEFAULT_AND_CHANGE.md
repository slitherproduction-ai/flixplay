# Checkpoint 196 — Fluxo funcional de Controle Parental

Base: checkpoint 195 / versão 2.17.16.

## Entrega

- Implementada no módulo Android seguro a verificação, a persistência e a alteração de PIN parental.
- No primeiro acesso, o código padrão é `0000`; após validá-lo, são exibidas as categorias de Canais, Filmes e Séries para bloqueio individual.
- O PIN é derivado por PBKDF2 com salt aleatório e armazenado somente de forma criptografada pelo Android Keystore.
- Incluídas opções de alterar o PIN e restaurá-lo ao padrão `0000`, ambas exigindo o PIN atual.

## Arquivos

- `android/app/src/main/java/com/fastshot/slitherproduction/flixplay/security/SecureStorageModule.kt`
- `app/settings/parental.tsx`
- `CHANGELOG.md`
