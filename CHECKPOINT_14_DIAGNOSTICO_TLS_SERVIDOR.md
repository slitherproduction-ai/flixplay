# Checkpoint 14 — Diagnóstico TLS do servidor

Data: 2026-10-07

## Resultado do teste real

- O host informado redireciona para HTTPS e retornou `502 Bad Gateway` com falha de handshake TLS.
- A falha ocorre antes da autenticação; nenhuma credencial foi persistida ou registrada.
- O app já permite HTTP no Android. O bloqueio atual é do endpoint/certificado do provedor, não do manifesto do ELVANOQ.

## Correção no app

- Respostas 502/525/526 agora informam falha TLS/SSL e orientam usar o endereço/porta Xtream fornecidos pelo provedor ou corrigir o certificado.
- Adicionado teste automatizado para garantir que esse cenário não seja classificado como senha inválida.

## Validação

- TypeScript e ESLint dos arquivos alterados aprovados.
- Testes de transporte e diagnóstico Xtream: 4 aprovados.
