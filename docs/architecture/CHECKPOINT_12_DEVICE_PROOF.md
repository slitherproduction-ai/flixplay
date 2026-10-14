# Checkpoint 12 — Device proof of possession (staging)

## Endpoints
- POST /v1/devices/:id/proof-key — register Ed25519 PEM public key, authenticated with existing device bearer token; registration is one-time, no insecure overwrite.
- POST /v1/devices/:id/challenge — returns a server-generated random 32-byte nonce valid for 60 seconds.
- POST /v1/devices/:id/entitlement/proof — submit nonce and Ed25519 signature of UTF-8 bytes: `ELVANOQ-ENTITLEMENT-PROOF-V1\n<deviceId>\n<nonce>`, authenticated with the device bearer; nonce is consumed atomically before entitlement issuance.
- GET /v1/devices/:id/entitlement — legacy endpoint refuses issuance after device has registered an asymmetric proof key.

## Security limits
This is a transitional protocol. Possession of the bearer token is still required; unlike a basic bearer-only request, an attacker must also obtain the private device key after enrollment to request an entitlement. Initial public-key enrollment can be hijacked if an attacker already holds the device bearer token before enrollment. Production readiness requires enrollment attestation/confirmation, trusted key storage (Android Keystore), recovery/rotation, device enrollment throttling, security tests for concurrency and replay, proper proxy handling and key compromise procedures. No MAC access is required.

Nonce hashes are persisted in PostgreSQL and consumed with an atomic conditional update; expired and consumed challenges cannot be reused. Clean up old rows with a maintenance job before production.

No Android integration, offline grace, VPS deployment or payments are active. The existing Android app is unchanged.
