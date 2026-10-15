# ELVANOQ Cloud — portal de vinculação (Checkpoint 25)

Primeira interface web isolada em React/Vite. Ela permite login com `POST /v1/auth/login`, recebe `accessToken` e envia código de 8 dígitos ao `POST /v1/devices/claim` com Bearer. A sessão permanece somente em memória, não em localStorage. Há opção de logout.

Para desenvolvimento, configure `VITE_LICENSE_API_URL` com a origem HTTPS do backend e execute `npm install && npm run dev` em `apps/cloud-portal`. Ajuste `CORS_ORIGINS` do NestJS para corresponder à origem do portal.

**Não há implantação Hostinger, checkout, cadastro público via UI, refresh de sessão, painel de dispositivos ou pagamentos.** Essa interface não afirma que a licença foi ativada: apenas que a conta vinculou o dispositivo. Recarregar a página descarta a sessão local, mas não encerra automaticamente a sessão no servidor (o usuário pode sair pelo botão).
