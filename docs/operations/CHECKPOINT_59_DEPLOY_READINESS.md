# ELVANOQ — Checkpoint 59: implantação controlada e recuperação

**Estado:** preparação documental; NÃO implantado.  
**Ambiente:** Hostinger (VPS), API e portal ELVANOQ.  
**Referência do aplicativo:** APK 2.17.13 informado/validado no fluxo do projeto; esta mudança não recompila APK.  
**GitHub:** no início deste checkpoint, release mais recente identificado no branch principal: 2.17.12. Não assumir sincronização de 2.17.13.

## 1. Regras de segurança

- Nenhuma alteração em produção, DNS, Nginx, TLS ou banco é autorizada por este documento.
- Preservar secrets exclusivamente no gerenciador de segredos/ambiente; jamais em commits, logs ou artefatos públicos.
- Antes do deploy: registrar commit SHA da API/portal, tag de imagem (imutável), host de destino e identificador de backup.
- Exigir confirmação de rollback testado em staging ou ambiente equivalente.
- Implantação só avança após aprovação explícita e coleta de evidências verificáveis.

## 2. Preflight (bloqueante)

- [ ] Confirmar inventário: host, distribuição, proxy, runtime/container, diretório da aplicação e serviço systemd/compose.
- [ ] Identificar domínio oficial da API e portal sem inferir URLs.
- [ ] Checar validade TLS, redirects HTTP→HTTPS, upstream e rotas de health.
- [ ] Identificar migrações de banco, política de backup/restauração e compatibilidade de schema.
- [ ] Validar CPU, RAM, disco, permissões, portas e regras de firewall.
- [ ] Registrar versão atual do código e integridade do backup; ensaiar restauração.
- [ ] Rodar CI/testes, lint e verificações de segurança; zero falhas bloqueantes.
- [ ] Verificar compatibilidade da API com clientes instalados, inclusive ELVANOQ 2.17.13.

## 3. Health checks

Definir com os serviços reais, SEM supor que estas rotas já existem:

- **Liveness**: `GET /health/live` → 200 se processo responde; sem credenciais nem detalhes internos.
- **Readiness**: `GET /health/ready` → 200 apenas se dependências necessárias estiverem aptas; 503 caso contrário.
- **Portal**: rota pública existente, status 200, certificado válido e carregamento de recursos essenciais.
- **API**: smoke test de contrato autenticado com conta de teste; nunca expor tokens em logs.
- Monitorar erros 5xx, latência p95, saturação de CPU/RAM, espaço em disco e falhas de upstream/TLS.

As rotas e métricas acima são **especificação alvo**, não evidência de implementação.

## 4. Deploy por etapas (somente quando autorizado)

1. Fazer backup verificado e registrar SHA do artefato e commit anterior.
2. Publicar artefato imutável em staging; executar smoke tests e compatibilidade.
3. Preparar configuração de proxy validada em staging (por exemplo `nginx -t` quando Nginx for confirmado).
4. Implantar em produção com janela de manutenção e tráfego controlado, se suportado.
5. Observar health checks, logs sanitizados e métricas após a troca.
6. Anotar resultado, horários, responsável, commit e evidência.

**Gates de avanço**: prontidão positiva, ausência de regressões P0/P1 e validação manual dos fluxos críticos (login, catálogo, reprodução, TV ao vivo, perfil/controle parental).

## 5. Critérios de rollback

Rollback imediato ou interrupção da promoção diante de:
- readiness negativa persistente ou indisponibilidade da API/portal;
- erro generalizado em login/autenticação;
- reprodução e TV ao vivo degradadas;
- aumento relevante e sustentado de 5xx/timeout;
- migração incompatível ou suspeita de perda de dados.

Procedimento:
1. Congelar novas promoções/releases e registrar início do incidente.
2. Restaurar serviço e configuração anteriormente aprovados, sem reverter banco cegamente.
3. Se houve migração destrutiva, usar plano de recuperação de dados validado, nunca simplesmente apontar software antigo para schema incompatível.
4. Validar rotas e smoke tests novamente, comparar métricas e monitorar.
5. Registrar causa, impacto, ações e critério para retomar.

## 6. Evidências de fechamento

- [ ] Inventário Hostinger revisado com acesso autorizado.
- [ ] Backup testado e recuperação documentada.
- [ ] Smoke tests automatizados e executados contra staging.
- [ ] Painéis/alertas ativos, proprietários e limiares aprovados.
- [ ] Plano de rollback exercitado.
- [ ] Validação específica de integração com APK 2.17.13.
- [ ] Aprovação para deploy em produção registrada.

**Checkpoint 59 preparado, mas não homologado nem implantado.** Próximo passo: levantamento técnico da VPS/serviços e execução de ensaio em staging antes de qualquer mudança de produção.
