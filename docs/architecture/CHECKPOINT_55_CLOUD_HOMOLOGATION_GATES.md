# Checkpoint 55 — Cloud homologation gates

## Status

The cloud services remain pre-production. No deploy, payment, license mutation or APK build has been authorized. The following gates must pass in an isolated staging environment before release:

1. PostgreSQL migration deploy and schema check, using a private staging DATABASE_URL; evidence of backup restore.
2. Throttle shared-store health; forced outage yields HTTP 503, restored availability yields HTTP 200, excessive requests yield HTTP 429.
3. Concurrency/load measurements with agreed error budget and latency targets; independent clients and realistic reverse-proxy behavior.
4. Trusted proxy configuration that prevents untrusted X-Forwarded-For spoofing; rate-limit behavior under multi-instance routing.
5. Secret management, TLS, CORS, auditing, session MFA and recovery runbook, plus security review.
6. Signed device entitlements and revocation in staging; billing provider sandbox webhook integrity and idempotency.
7. Android/TV regression, keystore/version compatibility, portal accessibility, staging rollback and recovery tests.
8. Explicit owner approval for deployment and a separate production readiness review.

## Opt-in preflight

From services/license-api with staging environment configured:
`THROTTLE_PREFLIGHT_CONFIRMED=true npm run security:preflight-throttle`

The preflight verifies PostgreSQL connectivity and the throttle bucket migration, then returns aggregate bucket counts. It is intentionally disabled when NODE_ENV=production and performs no writes. It is not an outage/restart test, and the command was not run against Hostinger or production.

## Next work

Prepare isolated PostgreSQL restart tests and benchmark evidence; build out the commercial portal and payment sandbox in separate steps, without enabling production transactions.
