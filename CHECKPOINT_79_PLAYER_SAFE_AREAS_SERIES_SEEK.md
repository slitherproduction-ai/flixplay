# Checkpoint 79 — Player seguro, séries e linha do tempo

Data: 2026-10-11
Versão-base: 2.17.2

## Entregas

- Controles superiores do player respeitam as áreas seguras do dispositivo e ganham recuo extra no lado da barra de navegação do smartphone.
- Ajustes verticais de brilho e volume mantêm distância segura das bordas; continuam ocultos no modo TV.
- O painel inferior recebeu degradê profundo, preservando a leitura de título, canal e progresso sobre vídeos claros.
- A linha do tempo passou a converter o toque pela posição global da barra e a aplicar busca absoluta, sem depender de um estado de reprodução defasado.
- O avanço e retrocesso de 10 segundos também usam posição absoluta atualizada.
- Episódios carregam a sequência real da série pelo Xtream Codes e mostram, quando aplicável, as ações **Pular abertura** e **Próximo episódio**.
- O Histórico de versões em Ajustes documenta as melhorias do player na versão 2.17.2.

## Validação

- Dependências restauradas a partir do `package-lock` e cache npm local preenchido e validado em instalação offline.
- Checagem de tipos (`tsc --noEmit`) aprovada.
- Testes automatizados aprovados: 26 suítes e 111 testes.
- Corrigido também o uso incompatível de `StyleSheet.absoluteFillObject` na tela de login.

## Próximo passo

Quando autorizado, restaurar as dependências do projeto e gerar um APK universal para homologação em smartphone, TV, Fire TV e Fire Stick.
