# Checkpoint 45 — Real HTTP boundary tests

An isolated NestJS application is bootstrapped on ephemeral loopback TCP port for integration tests. HTTP requests verify successful login response and `Cache-Control: no-store`, MFA verification response with no-store, and HTTP 400 on invalid recovery route UUID. Injected stub services ensure no live customer, payment, or license data are accessed.

The suite uses Vitest-specific constructor metadata setup for mocked Nest providers. No valid TOTP verification or distributed throttling is demonstrated by this particular HTTP suite; these require dedicated full-stack and multi-replica tests. No MFA credential recovery is enabled in production. Android APK 2.17.11, license writes and hosting unchanged.
