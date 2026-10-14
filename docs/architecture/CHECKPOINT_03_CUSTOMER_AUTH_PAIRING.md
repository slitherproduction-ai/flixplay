# Checkpoint 03 — Autenticação e vínculo de dispositivos

Data: 2026-10-14
Branch: feature/elvanoq-cloud-foundation
PR: #10 (draft)

## Implementado em código

- Cadastro e login de clientes por email e senha, com hash scrypt e salt aleatório.
- Sessões opacas aleatórias armazenadas somente como hash, expiração em sete dias e logout com revogação.
- Endpoint autenticado para resgatar código temporário de pareamento.
- Transação Prisma com tentativa de consumo atômico de código e auditoria.
- Modelo Prisma ampliado com CustomerSession e hash de senha.
- Dados Xtream/M3U não são encaminhados à API.

## Rotas adicionadas

- POST /v1/auth/register
- POST /v1/auth/login
- POST /v1/auth/logout
- POST /v1/devices/claim (Bearer customer access token, body: {"code":"12345678"})

## Atenção: NÃO pronto para implantação pública

- Migrações SQL ainda não geradas, executadas nem validadas.
- Não houve npm install, TypeScript build, banco PostgreSQL disponível ou teste de integração nesta execução.
- Registro público de clientes e dispositivos precisa de confirmação de email, proteção robusta anti-abuso/CAPTCHA e políticas de recuperação de conta.
- O código de pareamento precisa de política de tentativas por código/conta/dispositivo, uso de Redis para rate limits distribuídos, tratamento de conflitos/colisões e cenários concorrentes.
- Adicionar CSRF/cookies seguros se a interface web migrar de Bearer em memória para cookies.
- Implantação de produção exige gerenciamento de segredos, logs sanitizados e TLS.
- A versão Android existente não foi modificada.

## Próximo gate

1. Gerar migration Prisma inicial a partir do schema final, versionar SQL e testar up/down em banco limpo.
2. Criar pipeline CI para `npm ci`, `prisma validate`, `npm run build` e `npm test`.
3. Acrescentar testes e bloqueios antifraude antes de disponibilizar APIs publicamente.
4. Somente então iniciar a emissão de licenças em staging.
