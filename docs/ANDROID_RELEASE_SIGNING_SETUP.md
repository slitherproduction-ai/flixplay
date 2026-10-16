# ELVANOQ Play — instalação da identidade de assinatura no GitHub Actions

## Chave definitiva criada fora do repositório

A identidade é **PKCS12, RSA 4096, alias `elvanoq-release`**.

Certificado SHA-256 (referência pública, não segredo):
`61:53:43:8E:BB:9E:17:F9:35:C2:5E:C5:F9:E9:41:15:33:EF:D2:FD:C8:C4:8C:F5:A6:81:E8:B4:43:4B:65:7A`

NÃO adicionar keystore, cópias base64 ou senhas ao repositório.

## Configuração

No GitHub abra **Settings > Secrets and variables > Actions**.

Defina **Secrets**:
- `ELVANOQ_KEYSTORE_BASE64`: Base64 sem quebra de linha do conteúdo binário da nova `.p12`
- `ELVANOQ_KEYSTORE_PASSWORD`: senha de acesso ao arquivo
- `ELVANOQ_KEY_ALIAS`: `elvanoq-release`
- `ELVANOQ_KEY_PASSWORD`: senha da chave (igual à store password na keystore criada)
- `EXPO_PUBLIC_TMDB_ACCESS_TOKEN`: token TMDB de build necessário pelo projeto; é incluído no bundle cliente, portanto não trate como secreto no aplicativo.

Defina **Variable**:
- `ELVANOQ_CERT_SHA256`: `61:53:43:8E:BB:9E:17:F9:35:C2:5E:C5:F9:E9:41:15:33:EF:D2:FD:C8:C4:8C:F5:A6:81:E8:B4:43:4B:65:7A`

Para converter a keystore localmente, sem transmitir para chat:
- Linux: `base64 -w0 elvanoq-release.p12`
- macOS: `base64 < elvanoq-release.p12 | tr -d '\\n'`

**Verifique o tamanho do valor Base64 e cole diretamente na interface de Secret.** Não o imprima em logs públicos nem arquivos versionados.

## Política de lançamento

1. Arquivar a keystore e as credenciais em locais separados e seguros; o backup AES-256 deve ser guardado longe da senha de recuperação.
2. Aprovar SHA exato do código e conferir se o release não está assinado com a debug keystore.
3. Integrar o workflow `.github/workflows/android-release.yml` à branch padrão por PR.
4. Executar `workflow_dispatch` com um SHA aprovado. O pipeline interrompe antes do build se faltar Secret ou o certificado divergir.
5. Conferir saída `aapt`, `apksigner`, arquiteturas e SHA-256 do APK. Validar instalação física.
6. Somente publicar um release após autorização explícita.

**Importante:** a nova chave não atualiza instalações assinadas por certificados diferentes. Planejar instalação limpa quando necessário.
