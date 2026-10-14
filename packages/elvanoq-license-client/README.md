# ELVANOQ licensing transport client — Checkpoint 14

Standalone TypeScript adapter preparing future Expo Android/Android TV integration. **Not imported by the Android app.**

- Device registration, one-time public-key enrollment, nonce challenge and device proof submission.
- Injectable native/Android Keystore Ed25519 signer and secure credential store are intentionally **not implemented**; do not substitute JavaScript-stored private keys.
- Secure HTTPS (localhost HTTP only for isolated development). The caller MUST verify the server's Ed25519 entitlement signature, public-key ID, issuer, audience, device ID, timestamps, and license expiry with a trusted pinned public key before trusting `authorized`.
- Never use `observeEntitlement` to gate playback, logins or content. It is informational and fail-open.
- Do not store provider Xtream/M3U credentials in the licensing system.
- Remaining: implement native keystore signer compatible with Android API 24 / TV hardware, pinned verification keys, secure credential persistence, authenticated enrollment/recovery, feature flags and device testing.

The interface is isolated to avoid changing the current 2.17.11 APK.

## Checkpoint 20: verification boundary

`src/verify-entitlement.ts` validates claim policy and rejects unsigned/malformed/expired/wrong-device tokens, but **only returns verified claims when an injected trusted Ed25519 verifier confirms the signature** using a pinned key. No Android API 24 Ed25519 implementation is present yet; do not enable enforcement or treat a returned API status as cryptographic proof.
