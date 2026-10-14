# Checkpoint 23 — legacy Android TV compatibility diagnostics

Cloud CI #38594586859 passed. Android CI #38594587242 was still running on initial check.

The native module now exposes `inspectEd25519Verifier` to report whether this device's Android security providers expose Ed25519 KeyFactory and Signature. A TypeScript adapter supplies diagnostics for staging. This is only provider detection, not proof of valid cryptographic behavior.

**Outstanding:** real API 24 Android TV, older Fire TV, Google TV devices; a signed positive/negative verification test executed on-device; app life-cycle and keystore tests. The existing Ed25519 token remains fail-closed on incompatible providers. Do not enable mandatory licensing until compatible verification is implemented and tested. Device enrollment and playback remain unchanged.
