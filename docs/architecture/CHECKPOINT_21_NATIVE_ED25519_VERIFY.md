# Checkpoint 21 — Native Ed25519 entitlement verifier

The Kotlin Android bridge now exposes `verifyEd25519` and the TypeScript adapter `services/android-entitlement-verifier.ts` connects it with `packages/elvanoq-license-client/src/verify-entitlement.ts`.

The verification returns `false` on missing Ed25519 platform provider, unsupported device, invalid signature, or native errors. Token policy requires a pinned Ed25519 public key, matching key ID, issuer, audience, device ID and expiry. **The observer does not automatically trust or enforce token results.**

Platform compatibility remains unconfirmed for Android API 24 and older Fire TV; a bundled, audited Ed25519 verifier may be required. A successful Kotlin compile does not prove hardware/provider compatibility.

Pending: real device tests, deployment staging API, provision public key pin-set, error telemetry without leaking credentials, and native end-to-end signing-verification tests. No licensing restriction, client payments, new release APK, or Hostinger deployment.
