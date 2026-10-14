# Checkpoint 78 — Acesso M3U pelo login

Data: 2026-10-11

## Alteração concluída

- Adicionada a ação premium “Lista M3U” na tela de login, para smartphone e TV.
- A ação abre o cadastro existente com M3U pré-selecionado.
- O formulário de importação permite URL M3U/M3U Plus, XMLTV opcional e nome da lista.
- Ao salvar uma lista M3U iniciada pelo login, o app segue para as abas e inicia a importação real de canais; não retorna indevidamente para a tela de login.

## Escopo preservado

- Xtream Codes permanece como fluxo principal da tela de login.
- O importador M3U/XMLTV, parser e sincronização já existentes são reutilizados, sem duplicação de lógica.
