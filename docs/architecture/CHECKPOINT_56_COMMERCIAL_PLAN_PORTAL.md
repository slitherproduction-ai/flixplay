# Checkpoint 56 — Prévia comercial do portal

Foi implementado um cartão responsivo e somente leitura para o plano anual de uso do ELVANOQ Play no portal do cliente. Apresenta a referência de R$ 24,90 por dispositivo/ano, diferencia claramente a licença de software de qualquer acesso a canais, filmes, séries ou listas IPTV e informa que compras/renovações não estão disponíveis. Não existem botões de pagamento nem transações nesta etapa.

Arquivos: `apps/cloud-portal/src/commercial-plan.tsx`, integração em `src/main.tsx` e estilos responsivos em `src/style.css`. O cartão é exibido independentemente da autenticação para apresentar transparência comercial, sem modificar os fluxos existentes de login e vinculação.

Próxima entrega: fluxo de solicitação de renovação em ambiente de testes, conforme políticas do canal, com antifraude, idempotência e confirmação por webhook antes de conceder licenças. Não foi implantado na Hostinger nem habilitado cobrança real.
