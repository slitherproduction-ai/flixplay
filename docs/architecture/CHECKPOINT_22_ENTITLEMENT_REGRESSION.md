# Checkpoint 22 — entitlement verification regression tests

Previous Android Native Validation #38593460968 and Cloud CI #38593461020: success.

The isolated license-client test suite now checks entitlement claim policy with a mock verifier AND actual Node Ed25519 sign/verify. Real crypto tests cover a valid entitlement, tampering, signing key mismatch, staged rotation, expiry and device mismatch. They exercise the pure TypeScript verification contract; they do **not** prove Android API 24/Fire TV supports the platform Ed25519 provider.

The production app still requires hardware/API 24 validation and an audited compatible provider fallback or a compatible server-signed scheme before enabling any enforcement. Existing observer remains disabled and no release APK was generated.
