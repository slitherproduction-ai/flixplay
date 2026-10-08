# Checkpoint 38 — Player: favorito e controle parental

## Favorito na barra do player

- Inserido ícone de coração na barra superior para canais ao vivo.
- O coração fica preenchido quando o canal está favoritado.
- O toque adiciona/remove o canal dos favoritos persistidos por servidor.
- A ação remota existente continua funcionando.

## Cadeado na barra do player

- Inserido ícone de cadeado funcional na barra superior.
- Cadeado fechado indica que o conteúdo atual está marcado como protegido.
- O toque abre a tela real de Controle parental; não foi adicionada ação
  decorativa ou bloqueio sem PIN.

## Validação

- `npx tsc --noEmit`: aprovado.
- `EXPO_NO_TELEMETRY=1 npm run lint`: aprovado.
- 4 suítes e 18 testes de player, favoritos por servidor e proteção parental
  aprovados.
- Nenhum APK foi gerado nesta etapa.
