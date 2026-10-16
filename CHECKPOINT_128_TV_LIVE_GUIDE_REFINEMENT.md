# CHECKPOINT 128 — TV ao Vivo: lista e preview

**Base do aplicativo:** 2.17.14  
**Data:** 16/10/2026  
**Commit de implementação:** `74f47950d62cc0f0c8a2d169dc602390ec710e67`

## Escopo concluído

- A coluna de canais da TV foi alinhada visualmente à lista de categorias.
- Cada linha de canal exibe somente logotipo e nome.
- Foram removidos da lista de TV: número do canal, selo “AO VIVO”, programa atual, horários, barra de progresso e próximo programa.
- O preview passou a manter um player nativo único e substituir explicitamente a fonte ao mudar o canal focado. Isso evita o preview vazio/preto observado em Android TV e Fire TV.
- O preview permanece com o EPG completo abaixo do vídeo: canal, programa atual, horários, progresso, descrição e próximo programa.
- Separação entre linhas ajustada para acompanhar o ritmo visual da coluna de categorias.

## Arquivo alterado

- `app/(tabs)/live.tsx`

## Validação pendente em dispositivo

1. Abrir **TV ao Vivo** em Android TV ou Fire TV.
2. Navegar pelos canais com o controle remoto e confirmar que o preview troca a cada foco.
3. Confirmar que o EPG aparece abaixo do preview.
4. Abrir um canal com **OK/Enter** e voltar para verificar que o foco retorna à lista.

## Convenção de release

A versão 2.17.14 permanece a versão-base deste checkpoint. Na próxima build, atualizar obrigatoriamente a versão apresentada na tela de login, além do histórico de versões e do changelog.
