# Minuta de Política de Dados — FlixPlay

> Documento técnico para revisão jurídica e de segurança. Não constitui política final publicada.

## Inventário resumido

| Dado | Finalidade | Local | Proteção esperada | Exclusão |
|---|---|---|---|---|
| Credenciais Xtream | Autenticação | Cofre do dispositivo | Keystore/armazenamento seguro | Ao excluir a lista ou todos os dados |
| Perfil não sensível do servidor | Identificar a lista | Banco local | Isolamento por servidor | Ao excluir a lista |
| Catálogo e EPG | Navegação/offline | SQLite/cache | Escopo por servidor e limite de cache | Limpeza, expiração ou exclusão |
| Favoritos/histórico/progresso | Continuidade de uso | Banco local | Integridade e migrations | A pedido do usuário |
| PIN parental | Controle de acesso | Cofre seguro | Hash forte com salt ou solução nativa | Ao desativar/excluir dados |
| Diagnóstico sanitizado | Suporte | Memória/arquivo exportado | Remoção de segredos | Manual/temporária |

## Princípios

- Minimização: manter somente o necessário para a função solicitada.
- Separação: catálogos e preferências isolados por servidor.
- Segredos: nunca registrar ou incluir em relatório usuário, senha, token, PIN ou URL autenticada.
- Consentimento: backup com credenciais e telemetria dependem de implementação segura e consentimento explícito.
- Integridade: migrations e restaurações devem ser transacionais e testadas antes do lançamento.
- Transparência: informação indisponível deve aparecer como “Não informado”, nunca como status inventado.

## Backup e restauração

O backup padrão deve conter apenas favoritos, progresso, histórico, preferências, organização e configurações sem segredos. Arquivos precisam de versão, verificação de integridade, validação de tamanho/formato e rejeição de conteúdo inválido. Antes de sobrescrever dados, criar ponto de recuperação local quando tecnicamente possível.

## Incidentes

Em suspeita de exposição, interromper distribuição, preservar evidências sanitizadas, avaliar impacto, corrigir a origem e seguir o procedimento legal aplicável: **[DEFINIR RESPONSÁVEIS E PRAZOS]**.

Versão da minuta: 2.15.0-draft.
