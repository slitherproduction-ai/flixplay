# Checkpoint 03 — Sequência de implementação

Estado preservado antes da próxima integração:

1. PIN parental em cofre Android e tela de criação/alteração/remoção.
2. Dados de favoritos, histórico e bloqueios isolados por servidor.
3. Parser M3U Plus e serviço de player externo preparados, ainda ocultos da interface.
4. TypeScript aprovado; Jest com 21 suítes e 97 testes aprovados.

Ordem obrigatória de continuidade:

1. Conectar bloqueios à UI de detalhes, categorias, busca e player com modal de PIN.
2. Integrar importador M3U/XMLTV ao banco local e às telas existentes.
3. Conectar player externo e Catch-up apenas quando os dados reais indicarem suporte.
4. Converter catálogos das telas para paginação real por banco.
5. Executar carga, lint Android, builds assinados e homologação física.
