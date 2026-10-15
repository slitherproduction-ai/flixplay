# Checkpoint 17 — ECDSA P-256 device proof

The backend now accepts an SPKI P-256 (`prime256v1`) or Ed25519 public key at initial enrollment. Each enrollment stores the algorithm (`ES256` or `Ed25519`). It verifies the same domain-separated challenge payload with SHA-256 ECDSA DER signatures for P-256 and raw signatures for Ed25519. The one-use nonce remains atomic in PostgreSQL.

A PostgreSQL test covers P-256 enrollment, concurrent nonce redemption and invalid signing keys. Existing Ed25519 users remain supported.

**Not implemented yet:** Android Keystore ECDSA signer, secure initial enrollment, proof-verification-on-API native test, device recovery, and release APK. The Android signing capability gate remains fail-closed; application observation is disabled by default. No paid license or Hostinger rollout is active.
