# Checkpoint 209 — Varredura de superfícies responsivas

## Base

- Versão: 2.17.16
- Branch: `main`
- Checkpoint anterior: 208

## Evidência e correções

- A referência de teste físico mostrou **Listas Salvas** em TV ocupando quase toda a largura e deixando botões e linhas excessivamente longos.
- TV e tablet agora exibem o painel centralizado, com largura máxima de 900/760 dp, altura limitada à área segura e rolagem interna.
- As ações do Portal ocupam uma linha proporcional em superfícies largas; no smartphone, continuam empilhadas no painel inferior original.
- Cadastro manual de servidor e Diagnóstico receberam contentores centrais de largura limitada em tablet e TV, preservando a estrutura vertical em smartphone.

## Preservações

- Navegação por D-Pad, foco inicial no botão Fechar, gestos/touch, vínculo de chave e sincronização de listas foram preservados.
- Nenhuma lista, sessão, credencial, identidade, favorito, histórico, licença, endpoint ou Host/DNS IPTV foi alterado.
- Não houve build Android, APK ou workflow de compilação.
