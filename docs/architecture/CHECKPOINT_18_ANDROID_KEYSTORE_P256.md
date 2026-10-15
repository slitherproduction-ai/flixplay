# Checkpoint 18 — Android P-256 native signer

A Kotlin React Native module now generates a non-exportable EC secp256r1 key using AndroidKeyStore, exposes only the SPKI public key and produces SHA256withECDSA DER signatures. The existing native module is registered in MainApplication. The TypeScript adapter bridges that module to the isolated ELVANOQ license client, which now accepts DER ECDSA signatures.

Enrollment is explicitly invoked; the app startup observer remains disabled by default. Existing keys are not silently overwritten. No private key is stored in JavaScript or in SecureStore.

Compatibility warning: API 24 support has not been demonstrated on Fire TV hardware. Device capability is not proof of hardware-backed storage or functional server integration. No Android Gradle APK build or on-device cryptographic test has completed yet.

Before activation: verify Android compilation, test Google TV/Fire TV including API 24, add signed-entitlement verification with pinned public keys, secure enrollment and recovery, prevent arbitrary native signing use, and perform full end-to-end nonce tests. No playback enforcement, production rollout or billing.
