# Validação de performance — Fire TV / Fire Stick

Versão alvo: ELVANOQ Play 2.17.16 (CP213).

Esta validação é física: não pode ser substituída por uma verificação estática. Execute em um Fire Stick representativo, com o aplicativo atualizado sobre uma instalação existente e uma lista autorizada de catálogo grande.

## Preparação

1. Reinicie o Fire Stick e feche aplicativos recentes.
2. Confirme a versão/build no login e preserve a mesma lista usada entre os cenários.
3. Registre somente modelo do aparelho, Fire OS, tamanho aproximado da lista e resultado. Não registre URL, usuário, senha, MAC ou chave.

## Cenários obrigatórios

| Cenário | Critério de aprovação |
| --- | --- |
| TV ao Vivo: 20 trocas de categoria | Sem fechamento, foco visível e retorno em até alguns segundos após cada troca. |
| Lista de canais: rolagem contínua | Sem acúmulo progressivo de engasgos; logos tardios não bloqueiam o D-pad. |
| Preview e EPG | Preview aparece, áudio não persiste ao sair da aba e EPG não desloca o foco. |
| Filmes e Séries: 10 aberturas alternadas | Nenhum encerramento; voltar retorna à posição esperada da grade. |
| Player: abrir/fechar 10 vezes | Player libera vídeo/áudio ao sair; OSD reaparece por OK e setas. |
| Série: fim do episódio | Contagem de 6 s é visível, Cancelar impede avanço e Próximo episódio manual continua funcional. |
| Retorno do app | Listas locais seguem disponíveis se Portal/rede estiverem indisponíveis. |

## Registro de falha

Ao ocorrer travamento ou fechamento, anote o último cenário, ação do controle remoto, tempo aproximado após abrir o app e se o preview/player estava ativo. Anexe, se disponível, o relatório técnico sanitizado do próprio aplicativo. Não envie credenciais ou URL de lista.
