# Checkpoint 218 — Estabilidade da digitação no Login

- Base: `2.17.16` (`20261032`), posterior ao checkpoint 217.
- Android: removido o caminho de blur nativo no card de login durante a abertura do teclado. A superfície equivalente permanece estável e legível.
- Android: a Activity passou a usar `adjustResize`; o `KeyboardAvoidingView` mantém comportamento somente no iOS, evitando redimensionamento concorrente do conteúdo.
- Navegação: propriedades `nextFocus*` dos campos agora são aplicadas exclusivamente em Android TV, Google TV e Fire TV; o login de smartphone e tablet não recebe atributos de D-Pad.
- Nenhuma credencial, lista salva, código de servidor, player ou fluxo de autenticação foi alterado.
