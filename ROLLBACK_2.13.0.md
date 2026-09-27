# Plano de rollback — FlixPlay 2.13.0

1. Interrompa a distribuição da 2.13.0 e preserve o APK, símbolos e logs sanitizados da ocorrência.
2. Reative a última release 2.12.1 assinada com o mesmo certificado.
3. Para downgrade Android, aumente o `versionCode` do pacote de rollback; o Android não instala um código inferior sobre um superior.
4. Não limpe dados do aplicativo: o snapshot 2.13.0 está cifrado e a 2.12.1 não consegue lê-lo. Oriente reinstalação apenas como último recurso e informe que isso remove listas locais.
5. Preferência segura: publique uma 2.13.1 corretiva que reutilize o cofre e o banco introduzidos na 2.13.0.
6. Valide login, migração, favoritos, histórico, player e assinatura em pelo menos um Fire TV e um smartphone antes de retomar a distribuição.
