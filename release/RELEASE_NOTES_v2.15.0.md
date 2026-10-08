# FlixPlay 2.15.0 — Build 20261006

> **Não lançada.** Conteúdo sujeito a alteração até o fechamento dos testes automatizados, build assinado e homologação física.

## Preparação realizada

- Persistência de catálogos reforçada com schema SQLite v2, índices, paginação, busca e gravação incremental por servidor.
- Sincronização protegida contra respostas vazias inesperadas, duplicidade e troca de servidor durante o processo.
- Player ganhou isolamento de sessão, fallback controlado, mapeamento de erros, salvamento de progresso em pausa/PiP/background e retorno ao canal anterior.
- Navegação TV corrigida no menu lateral, login, modais e restauração de foco.
- Tela **Sobre** revisada para não divulgar suporte M3U não homologado nem estados estáticos de estabilidade.
- Logs e dados persistidos passam por sanitização centralizada; credenciais e PIN usam armazenamento seguro quando o módulo nativo está disponível.
- Histórico de versões limitado dinamicamente à versão instalada e à antecessora.
- Documentos de release, rollback, compatibilidade, homologação, privacidade e dados preparados para revisão.

## Compatibilidade planejada

- Android 7.0 / API 24 ou superior.
- Smartphones, tablets, Android TV, Google TV e Fire TV.
- `armeabi-v7a` e `arm64-v8a`.
- Package `com.fastshot.slitherproduction.flixplay`.

## Instalação e atualização

Não desinstale a versão anterior se desejar preservar listas, favoritos, preferências e progresso. A atualização direta só é possível quando o novo artefato usa o mesmo package e o mesmo certificado da instalação existente.

## Validação executada

- TypeScript: aprovado.
- Lint JavaScript/TypeScript: aprovado.
- Jest: 18 suítes e 88 testes aprovados.
- Gradle 9.3.1: APK universal e AAB gerados em build release.
- `lintVitalRelease`: aprovado.
- Assinatura APK v2 e certificado compatível com as versões anteriores: verificados.

## Pendências para publicação

- Executar Android lint completo; o lint vital passou, mas o lint completo permaneceu bloqueado por dependência ausente no cache offline.
- Validar atualização sobre instalações reais anteriores.
- Concluir a matriz de homologação em Fire TV, Android TV, smartphone e tablet.
- Obter revisão jurídica das minutas.

Até essas evidências existirem, a decisão é: **Release Candidate — não autorizada para lançamento público**.
