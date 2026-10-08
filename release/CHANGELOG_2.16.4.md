# ELVANOQ 2.16.4 — Estabilização de inicialização e TV

## Corrigido

- A inicialização deixa de manter um carregamento indefinido quando o armazenamento seguro não responde.
- O aplicativo apresenta uma tela de recuperação com as ações **Tentar novamente** e **Voltar ao login**, preservando os dados locais.
- A saída na raiz exige dois acionamentos de Voltar e confirmação explícita, com foco inicial em **Não** para TV.

## Melhorado

- Login em TV agora utiliza largura máxima de leitura confortável, evitando campos excessivamente largos.
- Logo do login foi ampliada em smartphones compactos sem alterar o layout de TV.
- A tela Sobre passa a exibir somente 2.16.4 e 2.16.3.

## Mantido

- Package `com.fastshot.slitherproduction.flixplay`.
- APIs Android 24–36 e ABIs `armeabi-v7a` e `arm64-v8a`.
- Controle remoto nativo, zapping e grade rápida introduzidos na 2.16.3.
