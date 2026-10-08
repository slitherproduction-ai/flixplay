# Checkpoint 17 — APK assinado para instalação limpa

Data: 2026-10-07

- Android SDK 36, Build Tools 36.0.0, NDK 27.1.12297006, CMake 3.22.1 e JDK 17 foram preparados no ambiente de build.
- Uma chave RSA 4096 bits para instalação limpa foi criada em diretório privado ignorado pelo repositório.
- `assembleRelease` concluído para `armeabi-v7a,arm64-v8a`.
- APK gerado e assinatura v2 validada com `apksigner`.
- SHA-256: `d860f27b76106193caf1e74c01e7e061309bb2c16e6bdd36432ca0cb16b4306a`.

O APK não atualiza instalações antigas, pois usa uma chave nova. A homologação física e a validação de login com endpoint TLS válido seguem pendentes.
