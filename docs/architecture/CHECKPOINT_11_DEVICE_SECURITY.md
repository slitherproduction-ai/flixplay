# Checkpoint 11 — Device authorization regression coverage

State: development branch and draft PR #10, not production deployment.

New automated tests cover invalid device credentials, valid signed device-bound entitlements, revoked or absent licenses, missing signing keys and cross-device token rejection.

Security guarantees and limitations:
- The API uses an opaque per-installation device secret, so possession of that secret is sufficient to impersonate the registered installation. Extracted secrets may be replayed from another machine.
- The signed authorization is a bearer token. Cryptographic verification protects integrity and expiry, but does **not** prevent replay on its own.
- Revocation stops issuing new authorizations. An already issued authorization remains valid until its maximum five-minute expiry, unless an online revocation check is added.
- No offline grace or Android enforcement is active.
- Before commercial release: implement device-generated asymmetric proof-of-possession using nonces with a server-side atomic replay cache, rotate compromised credentials, add per-device and account throttling, validate revocation against the authoritative database when online, and test compromised-device recovery.
- Staging tests must not contain real private keys; test keys are generated ephemerally at runtime.
- ELVANOQ Play client must retain Xtream/M3U provider credentials locally; licensing backend does not need them.
