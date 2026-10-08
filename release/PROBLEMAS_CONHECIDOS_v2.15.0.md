# Problemas conhecidos e bloqueadores — FlixPlay 2.15.0

## Bloqueadores de lançamento público

- Homologação física obrigatória ainda não registrada.
- Atualização real sobre versões anteriores ainda precisa ser validada fisicamente; o certificado do artefato foi confirmado como idêntico ao histórico autorizado.
- Minutas jurídicas ainda exigem revisão profissional e dados definitivos do responsável pelo produto.
- O catálogo ainda é espelhado parcialmente no Zustand; o SQLite foi ampliado com paginação e busca, mas ainda não é a única fonte de verdade em todas as telas.
- O backend seguro do controle parental existe, porém os bloqueios ainda não estão integrados a todas as rotas e superfícies da interface.
- Backup/restauração, organização avançada de categorias e telemetria permanecem adiados.
- O atualizador continua como fluxo manual; ainda não valida hash e certificado dentro do aplicativo.
- O certificado histórico é compatível com as instalações anteriores, mas deve ser substituído por uma estratégia privada de assinatura de produção antes da distribuição pública.

## Limitações declaradas

- M3U não é anunciado porque o fluxo completo de importação e homologação não está concluído.
- Tizen, webOS e iOS não são entregues pelo projeto Android/Expo atual.
- PiP, teclas CH+/CH-, teclas coloridas e comandos numéricos dependem das capacidades expostas pelo aparelho/controle; o D-Pad deve continuar sendo a alternativa.
- O uso de servidores HTTP explícitos é permitido por compatibilidade, mas a conexão é fornecida sem criptografia pelo servidor e nunca recebe downgrade automático de HTTPS para HTTP.
- A instalação sobre uma versão existente exige package e certificado idênticos; não é possível garantir atualização com certificado diferente.

## Registro de novos problemas

| ID | Severidade | Ambiente | Descrição | Contorno | Estado |
|---|---|---|---|---|---|
| — | — | — | Nenhum problema adicional registrado neste documento | — | Pendente de testes |

Não transforme uma limitação em alegação de compatibilidade até existir evidência automatizada e, quando aplicável, física.
