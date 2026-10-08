# Plano de rollback — FlixPlay 2.15.0

## Objetivo

Restaurar o serviço para a versão 2.14.0 caso a 2.15.0 apresente regressão crítica, sem prometer downgrade preservando dados quando o Android ou o schema não permitirem.

## Gatilhos

- Crash na inicialização ou ANR recorrente.
- Falha de migração, perda de servidores, favoritos ou progresso.
- Reprodução indisponível em uma plataforma anteriormente suportada.
- Consumo de memória incompatível com dispositivos de entrada.
- Certificado, hash ou package divergente do aprovado.

## Antes da distribuição

1. Preservar o código-fonte e os artefatos assinados da 2.14.0.
2. Registrar SHA-256 e impressão digital do certificado dos artefatos 2.14.0 e 2.15.0.
3. Validar backup e restauração em dados sintéticos, sem credenciais reais.
4. Confirmar migrations ascendentes e comportamento ao interromper cada migration.
5. Manter rollout gradual e canal de suporte disponível.

## Procedimento

1. Pausar imediatamente o rollout da 2.15.0.
2. Registrar a versão, dispositivo e erro, sempre com logs sanitizados.
3. Se o usuário ainda estiver na 2.14.0, impedir nova oferta da versão afetada.
4. Publicar uma correção com `versionCode` maior usando o mesmo certificado. Android normalmente não permite instalar um APK com `versionCode` menor sobre outro maior.
5. Usar restauração de backup apenas quando a integridade e a compatibilidade do arquivo forem confirmadas.
6. Reexecutar testes de migração, atualização e reprodução antes de retomar o rollout.

## Recuperação local

Desinstalar o app apaga dados locais e deve ser tratado como último recurso, com aviso explícito. Nunca orientar limpeza de dados sem informar a consequência. Credenciais e PIN não devem constar em relatórios ou backups não criptografados.

## Responsáveis e decisão

| Etapa | Responsável | Evidência | Status |
|---|---|---|---|
| Pausar rollout | Publicação | Registro do canal | Pendente |
| Triagem técnica | Engenharia | Erro sanitizado | Pendente |
| Avaliar dados | Engenharia/QA | Teste de integridade | Pendente |
| Aprovar correção | Produto/QA | Relatório de reteste | Pendente |
| Retomar rollout | Responsável pela publicação | Aprovação humana | Pendente |
