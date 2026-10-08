# Pacote de preparação — FlixPlay 2.15.0

Este diretório reúne os documentos necessários para revisar a versão 2.15.0 antes de qualquer publicação. Os documentos não substituem testes em aparelhos reais nem aprovação jurídica.

## Estado atual

- Versão planejada: 2.15.0.
- Versão candidata: 2.15.0, build 20261006.
- Versão-base preservada para rollback: 2.14.0, build 20261005.
- Classificação até concluir a homologação: **Release Candidate — não autorizada para lançamento público**.
- Nenhuma publicação automática é permitida.

## Documentos

- `RELEASE_NOTES_v2.15.0.md`: notas provisórias da versão.
- `HOMOLOGACAO_v2.15.0.md`: roteiro e evidências dos testes físicos.
- `MATRIZ_COMPATIBILIDADE_v2.15.0.md`: plataformas e estado de validação.
- `ROLLBACK_v2.15.0.md`: retorno seguro à versão anterior.
- `PROBLEMAS_CONHECIDOS_v2.15.0.md`: bloqueadores e limitações.
- `TERMOS_USO_MINUTA_v2.15.0.md`: minuta para revisão jurídica.
- `POLITICA_PRIVACIDADE_MINUTA_v2.15.0.md`: minuta para revisão jurídica.
- `POLITICA_DADOS_MINUTA_v2.15.0.md`: resumo operacional do tratamento de dados.

## Regra de evidência

Marque um teste como aprovado somente após executá-lo. Informe dispositivo, sistema, resultado, evidência, erro, correção e reteste. Campos não executados devem permanecer como **Pendente**.

O APK/AAB, hashes e certificado devem ser acrescentados somente após o build final assinado. Nunca inclua keystore, senha, token ou credenciais reais neste diretório.
