# Checkpoint 36 — Controles de sessões administrativas

O painel administrativo agora apresenta a ação **Encerrar outras sessões**, com confirmação antes de enviar a solicitação à API. A API já exige uma sessão com MFA recente e revoga todas as outras sessões do administrador, preservando a sessão atual; a operação é auditada.

A revogação da própria credencial MFA permanece disponível apenas pela API e também exige MFA recente. Ela encerra todas as sessões e impede o recadastro usando somente senha. **Não existe recuperação de autenticador perdido**: será necessário definir verificação independente de identidade, dupla autorização, registro de auditoria e processo de recuperação de uso único antes de produção.

Nenhuma operação de licenciamento foi habilitada em produção, nem foram realizados pagamentos, implantação na Hostinger ou novo APK.
