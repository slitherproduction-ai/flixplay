# Matriz de compatibilidade — ELVANOQ 2.17.0

“Configurado” não significa “homologado”. Esta matriz só muda para homologado após evidência registrada em `HOMOLOGACAO_v2.17.0.md`.

| Plataforma | Requisito configurado | Automação | Homologação física | Estado |
|---|---|---|---|---|
| Smartphone Android | API 24+ | Testes de navegação, catálogo e serviços aprovados | Pendente | Não homologado |
| Tablet Android | API 24+ | Layout responsivo coberto parcialmente | Pendente | Não homologado |
| Android TV / Google TV | D-Pad | Testes de foco e navegação aprovados | Pendente | Não homologado |
| Fire TV / Fire Stick | APK compatível e D-Pad | Testes de foco e navegação aprovados | Pendente | Não homologado |
| `armeabi-v7a` | Build Android final | Pendente de SDK/build | Pendente | Não validado |
| `arm64-v8a` | Build Android final | Pendente de SDK/build | Pendente | Não validado |

## Estado dos fluxos

| Fluxo | Evidência automatizada | Evidência física | Estado |
|---|---|---|---|
| Login e segurança | Aprovada; inclui mensagem TLS para 502/525/526 | Pendente | Não homologado |
| M3U + XMLTV | Aprovada | Pendente | Não homologado |
| EPG e catch-up | Aprovada | Pendente | Não homologado |
| Catálogo e paginação | Carga simulada de 30 mil/100 mil aprovada | Pendente | Não homologado |
| Player e PiP | Cobertura de configuração/estado aprovada | Pendente | Não homologado |
| Touch e D-Pad | Aprovada | Pendente | Não homologado |
| Controle parental | Aprovada | Pendente | Não homologado |
