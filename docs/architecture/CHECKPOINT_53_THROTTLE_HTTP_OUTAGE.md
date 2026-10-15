# Checkpoint 53 — Rate-limit database failure HTTP handling

Introduced `FailClosedThrottlerGuard` as the global rate-limit guard. Non-HTTP errors from the underlying PostgreSQL-backed throttler are mapped to `503 Service Unavailable`, preventing requests from silently bypassing rate limits. Existing HTTP throttling errors (including normal 429 responses) are preserved. The HTTP test runs an isolated Nest server with an injected failing storage implementation and asserts status 503 and a generic error body, without exposing database internals.

GitHub ELVANOQ Cloud CI run 38643419871 passed. This is a deterministic simulated-storage outage test; real PostgreSQL disconnection/recovery testing, proxy readiness policy, and operational metrics remain outstanding. No production deploy, real payments, license mutations, or APK build.
