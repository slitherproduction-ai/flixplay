# Checkpoint 46 — HTTP input validation regression tests

A suite `admin-http-boundary.spec.ts` now checks validation of invalid login email/password, unexpected request fields (whitelist and forbidNonWhitelisted), and malformed MFA TOTP codes, in addition to login response no-store and invalid recovery UUIDs. Real requests are sent to an isolated NestJS server on loopback with mock services.

Vitest does not automatically provide NestJS DTO reflection metadata under the current test transpilation setup; the test explicitly defines `design:paramtypes` for controller constructors and DTO-bearing methods to exercise the actual ValidationPipe rather than accepting invalid requests. HTTP boundary tests passed in Cloud CI run 38625237358.

Still pending: end-to-end throttling validation across multiple API replicas with a shared store, review of trusted proxy headers, and full identity proofing for MFA recovery. No actual recovery reset, licensing writes, payment activation, Hostinger deployment or APK generation.
