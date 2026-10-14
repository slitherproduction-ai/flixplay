# Checkpoint 20 — Validation boundary

The Android native module compiles separately in GitHub Actions; this CI does not prove behavior on Fire TV/Android API 24 hardware. The server issues Ed25519-signed tokens. P-256 is currently the DEVICE proof algorithm, not the token signing algorithm.

A client MUST verify cryptographic Ed25519 signature with pinned public keys (kid), issuer, audience, device ID, timestamps and expiration before it can trust the entitlement. Parsing a JWT, trusting the API JSON `authorized` field, or verifying only P-256 device signatures does not satisfy this requirement. A secure API-24-compatible Ed25519 verifier has not yet been selected. No enforcement allowed until validated.

Next: adopt and lock an audited Ed25519 verification dependency suitable for Hermes/React Native and Android 24, implement tests for tampering, key rotation, expiry and wrong device, and validate on physical hardware. No private signing keys belong in the client.
