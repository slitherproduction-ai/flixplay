# ELVANOQ — Checkpoint 60: inventário da Hostinger e homologação

**Status:** auditoria de repositório concluída; infraestrutura remota ainda não inspecionada.  
**Branch:** chore/checkpoint-59-deploy-readiness  
**Escopo:** levantamento não destrutivo; nenhuma implantação/alteração em produção.

## Constatações verificadas no GitHub

1. `README.md` informa ELVANOQ Play v2.17.12, aplicativo Expo/React Native para TV ao vivo e VOD, com alvo Android/Fire TV.
2. `package.json` informa versão `2.17.12`; scripts `lint`, `test` e `android:universal`. Não há script explícito de deploy de backend/portal neste manifesto.
3. Busca no índice do repositório por `hostinger` não encontrou arquivo correspondente; buscas por `portal`, `docker` e `deploy` não demonstraram um serviço de backend/portal implantável (resultados genéricos em `bun.lock`, `biome.json` e `metro.config.js`).
4. A existência, os endereços e a arquitetura da VPS/API/portal permanecem **não verificados**; não inferir implantação ou disponibilidade.
5. APK 2.17.13 foi informado no contexto do projeto, mas **não está confirmado no GitHub inspecionado**.

## Inventário a obter por acesso autorizado à Hostinger

| Campo | Evidência requerida | Status |
|---|---|---|
| VPS/host e SO | hPanel + `hostnamectl` sanitizado | pendente |
| Contêineres | `docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'` se Docker existir | pendente |
| Serviços | `systemctl list-units --type=service --state=running` com revisão de segredos | pendente |
| Proxy | Nginx/Apache/Caddy, arquivos ativos, `nginx -t` se aplicável | pendente |
| DNS/TLS | FQDNs oficiais, DNS resolvido, certificado e validade | pendente |
| Aplicação | diretório de deployment, SHA/tag, unit/compose | pendente |
| Banco | engine, versão, migrações, retenção e recuperação | pendente |
| Backup | evidência de cópia e teste de restauração | pendente |
| Métricas | logs sanitizados, latência, 5xx, recursos e alertas | pendente |

Não coletar tokens, senhas, `.env` ou chaves privadas. Não publicar IP privado, dados de clientes ou URLs administrativas restritas.

## Roteiro de inspeção (somente leitura)

1. Confirmar quais domínios e serviços pertencem ao ELVANOQ; separar aplicativo mobile de backend e painel.
2. Levantar arquitetura: DNS → TLS/proxy → app/container → dependências/banco.
3. Verificar recursos e versões sem reiniciar serviços.
4. Identificar endpoint **existente** de health (se não houver, registrar a ausência e implementar depois sob change control).
5. Medir baseline de respostas 2xx/4xx/5xx, latência p95 e recursos, sem solicitar credenciais em logs.
6. Definir homologação em staging e smoke test de autenticação por conta de teste, catálogo e fluxos compatíveis com 2.17.13.
7. Confirmar política de restauração e rollback antes de mudança.

## Matriz de homologação

| Área | Critério | Estado |
|---|---|---|
| TLS | certificado válido, chain íntegra e redirects corretos | não executado |
| Portal | rota oficial serve UI/JS/CSS e fluxo de login de teste | não executado |
| API | respostas válidas e manejo de erros sem exposição de dados | não executado |
| Compatibilidade | clientes 2.17.12 e APK 2.17.13 sem regressões | não executado |
| Resiliência | prontidão negativa bloqueia deploy; recovery testado | não executado |
| Backup | restauração provada em ambiente isolado | não executado |
| Observabilidade | alertas úteis e retenção de logs sanitizados | não executado |

## Bloqueadores para promoção a produção

- Falta confirmação do inventário da Hostinger e acesso autorizado.
- Falta identificar repositório/diretório-fonte do backend e portal, caso existam.
- Falta staging equivalente, baseline, evidências de testes e backup restaurável.
- Falta sincronização/verificação do código correspondente ao APK 2.17.13.

**Resultado do Checkpoint 60:** plano e matriz de auditoria documentados. **Não significa que a VPS foi inspecionada, que testes foram executados ou que um deploy foi realizado.** Próxima execução com acesso à infraestrutura: inventário read-only e produção de relatório de evidências, sem mudanças de serviço.
