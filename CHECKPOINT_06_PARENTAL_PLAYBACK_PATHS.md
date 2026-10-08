# Checkpoint 06 — Proteção de retomada e troca de canal

Data: 2026-10-04

## Implementado nesta etapa

- A tela **Continuar assistindo** exige PIN antes de retomar conteúdo bloqueado.
- O carrossel **Continuar assistindo** da Home segue a mesma regra; episódios
  também verificam o ID da série, permitindo que o bloqueio aplicado à série
  proteja sua retomada.
- O player verifica o bloqueio antes de trocar de canal por grade rápida,
  zapping, canal anterior ou teclado numérico. A troca só acontece após a
  confirmação bem-sucedida do PIN.
- Cancelar o diálogo não inicia nem troca a reprodução.

## Cobertura atual das entradas

| Entrada | Situação |
|---|---|
| Detalhes de filme/série | protegida |
| TV ao vivo | protegida |
| Busca global | protegida |
| Continuar assistindo | protegida |
| Zapping / grade rápida / dígitos | protegida |

## Próxima sequência

1. Proteger a abertura e expansão do PiP e o player aberto por deep link.
2. Criar testes dirigidos do gate para cancelamento, PIN incorreto e desbloqueio.
3. Executar TypeScript, lint e Jest integralmente antes do próximo APK.

## Validação desta etapa

As dependências não permanecem materializadas entre as execuções deste ambiente;
por isso, as ferramentas de TypeScript/lint/Jest não puderam ser concluídas
nesta etapa. Nenhum resultado de teste é declarado como aprovado neste checkpoint.
